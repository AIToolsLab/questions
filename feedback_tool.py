import psycopg2
import random
import streamlit as st
from transformers import BartForConditionalGeneration, BartTokenizer

# establishing connection to the database used
my_connection = psycopg2.connect(database="postgres", user="souadyakubu", password="souadseny", host="localhost", port="5432")
cursor = my_connection.cursor()

# making a feedback table 
cursor.execute('''
    CREATE TABLE IF NOT EXISTS feedback (
        id SERIAL PRIMARY KEY,
        context TEXT,
        question TEXT,
        system_generated TEXT,
        rater_id INTEGER,
        rank INTEGER
    )
''')
my_connection.commit()

@st.cache(allow_output_mutation=True)
def generate_questions(model_choice, context):
    pass

def feedback_log(context, question, system, rater_id, rank):
    # putting the feedback data into the PostgreSQL database
    cursor.execute(
        "INSERT INTO feedback (context, question, system_generated, rater_id, rank) VALUES (%s, %s, %s, %s, %s)",
        (context, question, system, rater_id, rank)
    )
    my_connection.commit()

def main():
    st.title("Feedback Collection Tool")

    # collecting contexts 
    # contexts = st.text_area("Enter the contexts (one per line):").split("\n")

    #selecting random context
    # random_context = random.choice(contexts)

    #selecting some questions for the random context 
    # random_questions = generate_questions(model_choice, random_context)

    # for demonstration purposes, I'll assume we already have a random context and its generated questions.
    random_context = "This is a sample context."
    random_questions = ["What is your name?", "What are your hobbies?", "Tell me about your work experience."]

    st.subheader("Context:")
    st.write(random_context)

    st.subheader("Generated Questions:")
    for i, question in enumerate(random_questions):
        st.write(f"{i + 1}. {question}")
        
    #User Feedback
    selected_question_index = st.selectbox("Select the best question:", [i + 1 for i in range(len(random_questions))])

    rank = st.slider("Rate the question (1 = worst, 5 = best):", 1, 5)

    if st.button("Submit Feedback"):
        selected_question = random_questions[selected_question_index - 1]
        system_that_generated = "hyechanjun/interview-question-remake"
        rater_id = 1  #can be changed based on user authentication
        feedback_log(random_context, selected_question, system_that_generated, rater_id, rank)
        st.success("Feedback submitted successfully!")

if __name__ == "__main__":
    main()
