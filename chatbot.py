from ollama import Client
import os

# --- CONFIGURATION ---
# Les clés sont lues depuis les variables d'environnement, c'est plus sécurisé.
CLOUD_API_KEY = os.getenv("CLOUD_API_KEY")
WEB_SEARCH_API_KEY = os.getenv("WEB_SEARCH_API_KEY")
MODEL_NAME = "gpt-oss:20b-cloud"

# --- FONCTIONS POUR LA RECHERCHE WEB ---


def perform_web_search(query: str):
    """
    Effectue une recherche web en utilisant l'API d'Ollama et retourne les résultats.
    """
    try:
        print("🔍 Recherche d'informations sur le web...")
        web_client = Client()
        web_client._client.headers.update(
            {"Authorization": f"Bearer {WEB_SEARCH_API_KEY}"}
        )
        response = web_client.web_search(query=query)
        print("✅ Informations récupérées du web.")
        return response
    except Exception as e:
        print(f"❌ Erreur lors de la recherche web: {e}")
        return None


def format_search_results(search_response: dict) -> str:
    """
    Formate les résultats de la recherche en une chaîne de caractères pour le contexte du LLM.
    """
    if not search_response or "results" not in search_response:
        return ""
    top_results = search_response["results"][:3]
    if not top_results:
        return ""
    context = "Contexte issu d'une recherche web :\n\n"
    for i, result in enumerate(top_results, 1):
        context += f"{i}. Source: {result.get('url', 'N/A')}\n"
        context += f"   Titre: {result.get('title', 'N/A')}\n"
        content_snippet = result.get("content", "")[:400]
        context += f"   Contenu: {content_snippet}...\n\n"
    return context


# --- FONCTION PRINCIPALE DE CHAT (le "cerveau") ---


def chat(prompt: str, history: list, use_web_search: bool = False, images: list = None):
    """
    Discute avec le LLM en utilisant un historique de conversation.
    images: liste de strings base64 des images à analyser
    """
    try:
        llm_client = Client(
            host="https://ollama.com",
            headers={"Authorization": CLOUD_API_KEY},
        )
    except Exception as e:
        print(f"❌ Erreur de configuration du client Ollama Cloud : {e}")
        return history

    final_prompt = prompt
    if use_web_search:
        print("🔍 Mode recherche web activé - recherche forcée...")
        search_results = perform_web_search(prompt)
        if search_results:
            web_context = format_search_results(search_results)
            if web_context:
                final_prompt = f"""{web_context}
En te basant sur le contexte ci-dessus, réponds à la question suivante : "{prompt}"
Si le contexte ne suffit pas, utilise tes connaissances générales et l'historique de notre conversation.
"""
            else:
                print("⚠️ Recherche web activée mais aucun contexte récupéré")
                final_prompt = f"""[Mode recherche web activé]
Question : "{prompt}"
Note: Une recherche web a été tentée mais n'a pas retourné de résultats exploitables. Je vais répondre avec mes connaissances générales.
"""
        else:
            print("⚠️ Recherche web activée mais échec de la recherche")
            final_prompt = f"""[Mode recherche web activé]
Question : "{prompt}"
Note: Une recherche web a été tentée mais a échoué. Je vais répondre avec mes connaissances générales.
"""

    # Préparer le message avec images si présentes
    user_message = {"role": "user", "content": final_prompt}
    if images:
        print(f"📸 Ajout de {len(images)} image(s) au message")
        user_message["images"] = images

    messages = history + [user_message]

    try:
        print(
            f"\n🤖 Appel du modèle ({'avec recherche web' if use_web_search else 'sans recherche web'})..."
        )
        # Pour une API, nous ne streamons pas, nous attendons la réponse complète.
        response = llm_client.chat(model=MODEL_NAME, messages=messages, stream=False)
        response_content = response["message"]["content"]
        print("✅ Réponse reçue du modèle.")

        history.append({"role": "user", "content": prompt})
        history.append({"role": "assistant", "content": response_content})

    except Exception as e:
        print(f"\n❌ Une erreur est survenue lors de l'appel au LLM : {e}")

    return history
