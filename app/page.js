'use client';
import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import styles from './page.module.css';

export default function Home() {
    // État pour savoir si le chatbot réfléchit (pour l'animation et désactiver le bouton)
    const [isThinking, setIsThinking] = useState(false);

    // État pour l'historique de la conversation
    const [history, setHistory] = useState([]);

    // État pour le texte en cours de frappe dans le champ de saisie
    const [currentPrompt, setCurrentPrompt] = useState('');

    // État pour la case à cocher "Recherche Web"
    const [useWebSearch, setUseWebSearch] = useState(false);

    // Références pour le scroll et l'input
    const historyEndRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        historyEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [history]);

    const handleSubmit = async (event) => {
        event.preventDefault(); // Empêche le rechargement de la page
        if (!currentPrompt.trim() || isThinking) return; // Ne rien faire si le champ est vide ou si le bot réfléchit

        const newHistory = [...history, { role: 'user', content: currentPrompt }];
        setHistory(newHistory);
        setCurrentPrompt('');
        setIsThinking(true);

        try {
            // URL de votre backend (doit être définie dans vos variables d'environnement)
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

            const response = await fetch(`${apiUrl}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: currentPrompt,
                    history: history, // On envoie l'historique précédent
                    use_web_search: useWebSearch,
                }),
            });

            if (!response.ok) {
                throw new Error('La réponse du réseau était invalide');
            }

            const data = await response.json();
            // Ajoute la réponse de l'assistant à l'historique
            setHistory([...newHistory, data.response]);

        } catch (error) {
            console.error("Erreur lors de l'appel à l'API:", error);
            // Afficher un message d'erreur à l'utilisateur
            setHistory([...newHistory, { role: 'assistant', content: "Désolé, une erreur est survenue." }]);
        } finally {
            setIsThinking(false);
            // Remettre le focus sur l'input après la réponse
            setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
        }
    };

    return (
        <main className={styles.container}>
            {/* Boule interactive pour thinking state */}
            {isThinking && (
                <div className={styles.thinkingOrb}>
                    <div className={styles.orbCore}>
                        <div className={styles.orbLayer1}></div>
                        <div className={styles.orbLayer2}></div>
                        <div className={styles.orbLayer3}></div>
                        <div className={styles.orbPulse}></div>
                    </div>
                </div>
            )}
            
            {/* Contenu principal */}
            <div className={styles.mainContent}>
                {/* Header avec titre */}
                <div className={styles.header}>
                    <h1>Test Ollama</h1>
                    <p>Votre compagnon intelligent pour toutes vos questions</p>
                </div>
                
                {/* Zone d'affichage de la conversation */}
                <div className={styles.historyContainer}>
                    {history.length === 0 ? (
                        <div className={styles.welcomeScreen}>
                            <div className={styles.welcomeIcon}>
                                <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
                                    <path d="M12 2L13.09 8.26L22 9L13.09 9.74L12 16L10.91 9.74L2 9L10.91 8.26L12 2Z" fill="currentColor"/>
                                    <path d="M19 15L20.09 18.26L24 19L20.09 19.74L19 23L17.91 19.74L14 19L17.91 18.26L19 15Z" fill="currentColor"/>
                                    <path d="M5 6L5.5 7.5L7 8L5.5 8.5L5 10L4.5 8.5L3 8L4.5 7.5L5 6Z" fill="currentColor"/>
                                </svg>
                            </div>
                            <h1 className={styles.welcomeTitle}>Test Ollama</h1>
                            <p className={styles.welcomeSubtitle}>Commencez une conversation ci-dessous</p>
                            <div className={styles.quickActions}>
                                <button className={styles.quickAction} onClick={() => setCurrentPrompt('Explique-moi l\'intelligence artificielle')}>
                                    <span>🤖</span> IA Expliquée
                                </button>
                                <button className={styles.quickAction} onClick={() => setCurrentPrompt('Aide-moi avec du code Python')}>
                                    <span>🐍</span> Aide Python
                                </button>
                                <button className={styles.quickAction} onClick={() => setCurrentPrompt('Raconte-moi une histoire courte')}>
                                    <span>📚</span> Histoire
                                </button>
                                <button className={styles.quickAction} onClick={() => setCurrentPrompt('Donne-moi des conseils créatifs')}>
                                    <span>💡</span> Créativité
                                </button>
                            </div>
                        </div>
                    ) : (
                        history.map((msg, index) => (
                            <div key={index} className={msg.role === 'user' ? styles.userMessage : styles.assistantMessage}>
                                {msg.role === 'assistant' ? (
                                    <div className={styles.markdownContent}>
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm]}
                                            rehypePlugins={[rehypeHighlight]}
                                            components={{
                                            h1: ({children}) => <h1 className={styles.mdH1}>{children}</h1>,
                                            h2: ({children}) => <h2 className={styles.mdH2}>{children}</h2>,
                                            h3: ({children}) => <h3 className={styles.mdH3}>{children}</h3>,
                                            h4: ({children}) => <h4 className={styles.mdH4}>{children}</h4>,
                                            p: ({children}) => <p className={styles.mdParagraph}>{children}</p>,
                                            ul: ({children}) => <ul className={styles.mdList}>{children}</ul>,
                                            ol: ({children}) => <ol className={styles.mdOrderedList}>{children}</ol>,
                                            li: ({children}) => <li className={styles.mdListItem}>{children}</li>,
                                            blockquote: ({children}) => <blockquote className={styles.mdBlockquote}>{children}</blockquote>,
                                            code: ({inline, children}) => 
                                                inline ? 
                                                    <code className={styles.inlineCode}>{children}</code> :
                                                    <code className={styles.codeBlock}>{children}</code>,
                                            pre: ({children}) => <pre className={styles.preBlock}>{children}</pre>,
                                            a: ({href, children}) => <a href={href} className={styles.mdLink} target="_blank" rel="noopener noreferrer">{children}</a>,
                                            strong: ({children}) => <strong className={styles.mdBold}>{children}</strong>,
                                            em: ({children}) => <em className={styles.mdItalic}>{children}</em>,
                                            hr: () => <hr className={styles.mdDivider} />
                                        }}
                                        >
                                            {msg.content}
                                        </ReactMarkdown>
                                    </div>
                                ) : (
                                    msg.content
                                )}
                            </div>
                        ))
                    )}
                    <div ref={historyEndRef} />
                </div>

                {/* Formulaire de saisie en bas */}
                <div className={styles.footer}>
                    <form onSubmit={handleSubmit} className={styles.formContainer}>
                        <input
                            ref={inputRef}
                            type="text"
                            value={currentPrompt}
                            onChange={(e) => setCurrentPrompt(e.target.value)}
                            placeholder="Tapez votre message..."
                            className={styles.inputField}
                            disabled={isThinking}
                            autoFocus
                        />
                        <button type="submit" className={styles.micButton} disabled={isThinking}>
                            {isThinking ? '...' : '➤'}
                        </button>
                    </form>
                    <div className={styles.checkboxContainer}>
                        <input
                            type="checkbox"
                            id="web_search"
                            checked={useWebSearch}
                            onChange={(e) => setUseWebSearch(e.target.checked)}
                        />
                        <label htmlFor="web_search">Utiliser la recherche web</label>
                    </div>
                </div>
            </div>
        </main>
    );
}