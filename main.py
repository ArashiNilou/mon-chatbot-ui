import os
import base64
from io import BytesIO
from typing import List
from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# Charger les variables d'environnement (vos clés API)
load_dotenv()

# Importez votre logique de chatbot existante
# (J'ai simplifié en supposant que votre fonction chat est dans un fichier 'chatbot.py')
from chatbot import chat

try:
    from PIL import Image
    import PyPDF2
except ImportError:
    print("⚠️ Pillow et/ou PyPDF2 ne sont pas installés. Les fonctionnalités de fichiers seront limitées.")

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


def extract_text_from_pdf(file_content: bytes) -> str:
    """Extrait le texte d'un fichier PDF"""
    try:
        pdf_file = BytesIO(file_content)
        pdf_reader = PyPDF2.PdfReader(pdf_file)
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text() + "\n"
        return text.strip()
    except Exception as e:
        return f"Erreur lors de l'extraction du PDF: {str(e)}"


def process_image(file_content: bytes, filename: str) -> str:
    """Convertit une image en base64 pour l'envoyer au LLM"""
    try:
        image = Image.open(BytesIO(file_content))
        # Redimensionner si trop grande
        max_size = (1024, 1024)
        image.thumbnail(max_size, Image.Resampling.LANCZOS)

        buffered = BytesIO()
        image.save(buffered, format=image.format or "PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode()
        return f"[Image: {filename}]\nBase64: {img_str[:100]}... (image encodée)"
    except Exception as e:
        return f"Erreur lors du traitement de l'image: {str(e)}"


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


# Endpoint pour gérer le chat avec des fichiers
@app.post("/chat-with-files")
async def handle_chat_with_files(
    prompt: str = Form(...),
    history: str = Form(...),
    use_web_search: bool = Form(False),
    files: List[UploadFile] = File(...)
):
    import json
    history_list = json.loads(history)

    # Traiter les fichiers
    files_context = "\n\n=== FICHIERS UPLOADÉS ===\n"
    for file in files:
        content = await file.read()

        if file.content_type == "application/pdf":
            text = extract_text_from_pdf(content)
            files_context += f"\n📄 Fichier PDF: {file.filename}\nContenu:\n{text}\n"

        elif file.content_type in ["image/png", "image/jpeg", "image/jpg"]:
            img_info = process_image(content, file.filename)
            files_context += f"\n🖼️ {img_info}\n"

        else:
            files_context += f"\n❓ Fichier non supporté: {file.filename}\n"

    # Enrichir le prompt avec le contexte des fichiers
    enriched_prompt = f"{files_context}\n\n=== QUESTION DE L'UTILISATEUR ===\n{prompt}\n\nAnalyse les fichiers ci-dessus et réponds à la question."

    # Appeler la fonction chat avec le prompt enrichi
    updated_history = chat(
        prompt=enriched_prompt,
        history=history_list,
        use_web_search=use_web_search,
    )

    last_response = updated_history[-1] if updated_history else {}
    return {"response": last_response}
