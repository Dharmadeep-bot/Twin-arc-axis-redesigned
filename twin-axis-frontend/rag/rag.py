import os
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.document_loaders import WikipediaLoader
from langchain_google_genai import ChatGoogleGenerativeAI
from dotenv import load_dotenv
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain.tools import tool
from langchain.agents import create_agent
from langchain_core.documents import Document

# Global vectorstore for knowledge base
global_vectorstore = None
embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")

def add_to_vectorstore(text: str):
    global global_vectorstore
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=512, chunk_overlap=24)
    documents = text_splitter.split_documents([Document(page_content=text)])
    if global_vectorstore is None:
        global_vectorstore = FAISS.from_documents(documents, embeddings)
    else:
        global_vectorstore.add_documents(documents)
        
def extract_text(content):
    if isinstance(content, str):
        return content

    if isinstance(content, list):
        return "".join(
            block.get("text", "")
            for block in content
            if isinstance(block, dict) and block.get("type") == "text"
        )

    return ""

def analyze_with_rag(query: str):
    load_dotenv()
    os.environ["GOOGLE_API_KEY"] = "AIzaSyCA7atnVEdWSSblhMEcilBrL8akaKrn2Zc"

    llm = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        temperature=0.2
    )

    @tool(response_format="content_and_artifact")
    def retrieve_context(q: str):
        """
        Retrieve relevant context from uploaded documents stored in the vector database.
        Use this tool to answer questions based on user-uploaded PDFs.
        """
        if global_vectorstore:
            retrieved_docs = global_vectorstore.similarity_search(q, k=2)
            serialized = "\n\n".join(
                f"Content: {doc.page_content}" for doc in retrieved_docs
            )
            return serialized, retrieved_docs
        return "No uploaded documents available.", []

    tools = [retrieve_context]

    system_prompt = (
        "You are an industrial data analyst AI. "
        "You have access to a tool that retrieves context from uploaded documents. "
        "Use the tool when relevant. "
        "If no relevant context is found, answer based on general knowledge."
    )

    agent = create_agent(llm, tools, system_prompt=system_prompt)

    final_response = ""

    for event in agent.stream(
        {"messages": [{"role": "user", "content": query}]},
        stream_mode="values"
    ):
        msg = event["messages"][-1]

        # ✅ Capture ONLY the final AI message
        if msg.type == "ai" and msg.content:
            final_response = extract_text(msg.content)

    return final_response

# def run_rag(query: str):
#     # Load environment variables
#     load_dotenv()

#     # Set API key (assuming it's in .env or hardcoded for demo)
#     os.environ["GOOGLE_API_KEY"] = "AIzaSyCDoCZSiQ8jCMoSaWWkzuHzIYKIM-CRmMw"

#     # Initialize LLM
#     llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash")

#     # Define tool
#     @tool(response_format="content_and_artifact")
#     def retrieve_context(q: str):
#         """Retrieve information to help answer a query."""
#         if global_vectorstore:
#             retrieved_docs = global_vectorstore.similarity_search(q, k=2)
#             serialized = "\n\n".join((f"Content: {doc.page_content}") for doc in retrieved_docs)
#         else:
#             serialized = "No uploaded documents available."
#         return serialized, retrieved_docs if global_vectorstore else []

#     # Create agent
#     tools = [retrieve_context]
#     prompt = (
#         "You have access to a tool that retrieves context from uploaded documents. "
#         "Use the tool to help answer user queries. If no relevant context is found, answer based on general knowledge and suggest uploading relevant PDFs."
#     )
#     agent = create_agent(llm, tools, system_prompt=prompt)

#     # Run query
#     result = ""
#     for event in agent.stream(
#         {"messages": [{"role": "user", "content": query}]},
#         stream_mode="values",
#     ):
#         result += str(event["messages"][-1].pretty_print()) + "\n"

#     return result

# if __name__ == "__main__":
#     query = (
#         "Which house did Elizabeth I belong to?\n\n"
#         "Once you get the answer, look up common extensions of that method."
#     )
#     result = run_rag(query)
#     print(result)