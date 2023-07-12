import json
import os
import sqlite3
from typing import List

import openai
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from tenacity import (retry, stop_after_attempt,  # for exponential backoff
                      wait_random_exponential)

# Read env file
with open(".env", "r") as f:
    for line in f:
        key, value = line.split("=")
        os.environ[key] = value.strip()

openai.organization = "org-9bUDqwqHW2Peg4u47Psf9uUo"
openai.api_key = os.getenv("OPENAI_API_KEY")


class ReflectionRequestPayload(BaseModel):
    paragraph: str
    prompt: str


class ReflectionResponseItem(BaseModel):
    response_text: str
    relevant_to_sentence_number: int
    response_quality: float

class ReflectionResponses(BaseModel):
    reflections: List[ReflectionResponseItem]


app = FastAPI()

origins = [
    "*",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

db_file = "requests.db"

with sqlite3.connect(db_file) as conn:
    c = conn.cursor()
    c.execute(
        "CREATE TABLE IF NOT EXISTS requests (timestamp, prompt, paragraph, response, success)"
    )

def sanitize(text):
    return text.replace('"', '').replace("'", "")

async_chat_with_backoff = (
    retry(wait=wait_random_exponential(min=1, max=60), stop=stop_after_attempt(6))
    (openai.ChatCompletion.acreate)
)

async def get_reflections_chat(
    request: ReflectionRequestPayload,
) -> ReflectionResponses:
    # Check if this request has been made before
    with sqlite3.connect(db_file) as conn:
        c = conn.cursor()
        c.execute(
            "SELECT response FROM requests WHERE prompt=? AND paragraph=? AND success='true'",
            (request.prompt, request.paragraph),
        )
        result = c.fetchone()

        if result:
            response_json = result[0]
            response = json.loads(response_json)
            # assume that the database stores only valid responses in the correct schema.
            # We check this below.
            return ReflectionResponses(**response)

    # Else, make the request and cache the response

    # TODO: improve the "quality" mechanism
    desired_schema_prompt = '''
interface Response {
    response_text: str
    relevant_to_sentence_number: int
    response_quality: float
}

interface Responses {
  reflections: Response[];
}
'''

    prompt = sanitize(request.prompt)

    initial_messages = [
        {"role": "system", "content": prompt},
        {"role": "user", "content": sanitize(request.paragraph)},
    ]

    response = await async_chat_with_backoff(
        model="gpt-3.5-turbo",
        messages=initial_messages,
        temperature=.7,
        max_tokens=1024,
        top_p=1,
        frequency_penalty=0,
        presence_penalty=0,
    )

    # Extract the response
    response_text = response["choices"][0]["message"]["content"]
    print(response_text)

    conversion_messages = initial_messages + [
        {"role": "assistant", "content": response_text},
        {"role": "system", "content": "Convert the response into JSON format. Use the following schema:\n\n" + desired_schema_prompt},
    ]

    # Ask the LM to convert it to JSON
    conversion_response = await openai.ChatCompletion.acreate(
        model="gpt-3.5-turbo",
        messages=conversion_messages,
        temperature=.3,
        max_tokens=1024,
    )

    conversion_response_text = conversion_response["choices"][0]["message"]["content"]

    # Attempt to parse JSON
    try:
        print(conversion_response_text)
        response_json = json.loads(conversion_response_text)
        reflection_items = ReflectionResponses(**response_json)
    except Exception as e1:
        # If it still doesn't work, log the error and fail out
        with sqlite3.connect(db_file) as conn:
            c = conn.cursor()
            # Use SQL timestamp
            c.execute(
                'INSERT INTO requests VALUES (datetime("now"), ?, ?, ?, ?)',
                (request.prompt, request.paragraph, json.dumps(dict(
                    error=str(e1), 
                    response=response_text
                )), "false"),
            )
        raise e1

    # Cache the response
    with sqlite3.connect(db_file) as conn:
        c = conn.cursor()
        # Use SQL timestamp
        c.execute(
            'INSERT INTO requests VALUES (datetime("now"), ?, ?, ?, ?)',
            (request.prompt, request.paragraph, json.dumps(reflection_items.dict()), "true"),
        )

    return reflection_items


@app.post("/reflections")
async def reflections(payload: ReflectionRequestPayload):
    # ! Look at prompt and guidance/jsonformer
    api = "chat"

    if api == "chat":
        return await get_reflections_chat(payload)
    elif api == "completions":
        prompt = (
            """
            You are a writing assistant. Your purpose is to ask the writer helpful and thought-provoking reflections to help them think of how to improve their writing. For each question, include the phrase from the paragraph that it applies to. You must writing your reflections in the following JSON format:

            ```json
                    {
                    "reflections": [
                            {
                                "question": "{{gen 'question'}}",
                                "phrase": "{{gen 'phrase'}}"
                            },
                        ]
                    }
            ```

            Create 5 reflections for the following piece of writing using the JSON format above.
        """
            + payload.paragraph
            + "\n\n ```json \n"
        )

        response = openai.Completion.create(
            model="text-davinci-003",
            prompt=prompt,
            temperature=0.7,
            max_tokens=256,
            top_p=1,
            frequency_penalty=0,
            presence_penalty=0,
            echo=True,
        )

    return response["choices"][0]["text"].split("```json")[2]


@app.get("/logs")
async def logs():
    with sqlite3.connect(db_file) as conn:
        c = conn.cursor()
        c.execute("SELECT * FROM requests")
        result = c.fetchall()

    return result

uvicorn.run(app, port=8000)
