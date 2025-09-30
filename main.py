import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# Charger les variables d'environnement (vos clés API)
load_dotenv()

# Importez votre logique de chatbot existante
# (J'ai simplifié en supposant que votre fonction chat est dans un fichier 'chatbot.py')
from chatbot import chat

# Initialiser l'application FastAPI
app = FastAPI()

# --- Configuration CORS ---
# C'est TRÈS IMPORTANT. Cela autorise votre frontend (ex: sur Vercel)
# à appeler votre backend sur un autre domaine.
origins = [
    "http://localhost:3000",  # Pour le développement local
    "https://VOTRE_URL_FRONTEND.vercel.app",  # L'URL de votre site une fois déployé
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Définir le format des données attendues en entrée (Request Body)
class ChatRequest(BaseModel):
    prompt: str
    history: list
    use_web_search: bool


@app.get("/")
def read_root():
    return {"status": "Chatbot API is running"}


# Créer l'endpoint /chat
@app.post("/chat")
async def handle_chat(request: ChatRequest):
    # On appelle votre fonction chat existante avec les données de la requête
    updated_history = chat(
        prompt=request.prompt,
        history=request.history,
        use_web_search=request.use_web_search,
    )
    # On ne retourne que la dernière réponse de l'assistant
    last_response = updated_history[-1] if updated_history else {}
    return {"response": last_response}
