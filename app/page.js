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

    // État pour le thème (dark/light)
    const [isDarkMode, setIsDarkMode] = useState(true);

    // État pour les fichiers uploadés
    const [uploadedFiles, setUploadedFiles] = useState([]);
    const fileInputRef = useRef(null);

    // États pour la gestion des conversations
    const [conversations, setConversations] = useState([]);
    const [currentConversationId, setCurrentConversationId] = useState(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Fonction pour gérer l'upload de fichiers
    const handleFileUpload = (event) => {
        const files = Array.from(event.target.files);
        const validFiles = files.filter(file => {
            const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
            return validTypes.includes(file.type);
        });
        setUploadedFiles(prev => [...prev, ...validFiles]);
    };

    // Fonction pour ouvrir le sélecteur de fichiers
    const openFilePicker = () => {
        fileInputRef.current?.click();
    };

    // Fonction pour supprimer un fichier uploadé
    const removeFile = (index) => {
        setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    };

    // Charger le thème et les conversations depuis localStorage au montage
    useEffect(() => {
        const savedTheme = localStorage.getItem('chatbot-theme');
        if (savedTheme !== null) {
            setIsDarkMode(savedTheme === 'dark');
        }

        const savedConversations = localStorage.getItem('chatbot-conversations');
        if (savedConversations) {
            setConversations(JSON.parse(savedConversations));
        }
    }, []);

    // Sauvegarder le thème dans localStorage quand il change
    useEffect(() => {
        localStorage.setItem('chatbot-theme', isDarkMode ? 'dark' : 'light');
    }, [isDarkMode]);

    // Sauvegarder les conversations dans localStorage quand elles changent
    useEffect(() => {
        if (conversations.length > 0) {
            localStorage.setItem('chatbot-conversations', JSON.stringify(conversations));
        }
    }, [conversations]);

    // Sauvegarder la conversation actuelle quand l'historique change
    useEffect(() => {
        if (currentConversationId && history.length > 0) {
            const updatedConversations = conversations.map(conv =>
                conv.id === currentConversationId
                    ? { ...conv, history, updatedAt: new Date().toISOString() }
                    : conv
            );
            setConversations(updatedConversations);
        }
    }, [history]);

    // Créer une nouvelle conversation
    const createNewConversation = () => {
        const newConv = {
            id: Date.now(),
            title: 'Nouvelle conversation',
            history: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        setConversations([newConv, ...conversations]);
        setCurrentConversationId(newConv.id);
        setHistory([]);
        setCurrentPrompt('');
        setUploadedFiles([]);
        setSidebarOpen(false); // Fermer la sidebar automatiquement
        setTimeout(() => {
            inputRef.current?.focus();
        }, 100);
    };

    // Charger une conversation existante
    const loadConversation = (id) => {
        const conv = conversations.find(c => c.id === id);
        if (conv) {
            setCurrentConversationId(id);
            setHistory(conv.history || []);
            setCurrentPrompt('');
            setUploadedFiles([]);
            setSidebarOpen(false);
        }
    };

    // Supprimer une conversation
    const deleteConversation = (id) => {
        const filtered = conversations.filter(c => c.id !== id);
        setConversations(filtered);
        if (currentConversationId === id) {
            setCurrentConversationId(null);
            setHistory([]);
        }
    };

    // Mettre à jour le titre de la conversation basé sur le premier message
    const updateConversationTitle = (convId, firstMessage) => {
        const title = firstMessage.slice(0, 50) + (firstMessage.length > 50 ? '...' : '');
        const updatedConversations = conversations.map(conv =>
            conv.id === convId && conv.title === 'Nouvelle conversation'
                ? { ...conv, title }
                : conv
        );
        setConversations(updatedConversations);
    };

    // Références pour le scroll et l'input
    const historyEndRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        historyEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [history]);

    const handleSubmit = async (event) => {
        event.preventDefault(); // Empêche le rechargement de la page
        if (!currentPrompt.trim() || isThinking) return; // Ne rien faire si le champ est vide ou si le bot réfléchit

        // Créer une nouvelle conversation si aucune n'est active
        let convId = currentConversationId;
        if (!convId) {
            const newConv = {
                id: Date.now(),
                title: 'Nouvelle conversation',
                history: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            setConversations(prev => [newConv, ...prev]);
            setCurrentConversationId(newConv.id);
            convId = newConv.id;
        }

        // Mettre à jour le titre avec le premier message
        if (history.length === 0) {
            updateConversationTitle(convId, currentPrompt);
        }

        const userPrompt = currentPrompt; // Sauvegarder avant de réinitialiser
        const newHistory = [...history, { role: 'user', content: userPrompt }];
        setHistory(newHistory);
        setCurrentPrompt('');
        setIsThinking(true);

        try {
            // URL de votre backend (doit être définie dans vos variables d'environnement)
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

            // Si des fichiers sont uploadés, on les envoie avec FormData
            if (uploadedFiles.length > 0) {
                const formData = new FormData();
                formData.append('prompt', userPrompt);
                formData.append('history', JSON.stringify(history));
                formData.append('use_web_search', useWebSearch);

                uploadedFiles.forEach((file, index) => {
                    formData.append('files', file);
                });

                const response = await fetch(`${apiUrl}/chat-with-files`, {
                    method: 'POST',
                    body: formData,
                });

                if (!response.ok) {
                    throw new Error('La réponse du réseau était invalide');
                }

                const data = await response.json();
                setHistory([...newHistory, data.response]);
                setUploadedFiles([]); // Réinitialiser les fichiers après envoi
            } else {
                // Sans fichiers, on utilise l'endpoint classique
                const response = await fetch(`${apiUrl}/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        prompt: userPrompt,
                        history: history,
                        use_web_search: useWebSearch,
                    }),
                });

                if (!response.ok) {
                    throw new Error('La réponse du réseau était invalide');
                }

                const data = await response.json();
                setHistory([...newHistory, data.response]);
            }

        } catch (error) {
            console.error("Erreur lors de l'appel à l'API:", error);
            // Afficher un message d'erreur détaillé à l'utilisateur
            const errorMessage = error.message.includes('fetch') || error.message.includes('network')
                ? "Impossible de contacter le serveur. Vérifiez que le backend est en cours d'exécution."
                : `Désolé, une erreur est survenue: ${error.message}`;
            setHistory([...newHistory, { role: 'assistant', content: errorMessage }]);
        } finally {
            setIsThinking(false);
            // Remettre le focus sur l'input après la réponse
            setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
        }
    };

    return (
        <main className={`${styles.container} ${isDarkMode ? styles.dark : styles.light}`}>
            {/* Sidebar pour les conversations */}
            <div className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
                <div className={styles.sidebarHeader}>
                    <h2>Conversations</h2>
                    <button
                        className={styles.closeSidebarButton}
                        onClick={() => setSidebarOpen(false)}
                        title="Fermer"
                    >
                        ✕
                    </button>
                </div>
                <button
                    className={styles.newConversationButton}
                    onClick={createNewConversation}
                >
                    + Nouvelle conversation
                </button>
                <div className={styles.conversationList}>
                    {conversations.map(conv => (
                        <div
                            key={conv.id}
                            className={`${styles.conversationItem} ${conv.id === currentConversationId ? styles.conversationActive : ''}`}
                            onClick={() => loadConversation(conv.id)}
                        >
                            <div className={styles.conversationTitle}>{conv.title}</div>
                            <button
                                className={styles.deleteConversationButton}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    deleteConversation(conv.id);
                                }}
                                title="Supprimer"
                            >
                                🗑️
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Overlay pour fermer la sidebar sur mobile */}
            {sidebarOpen && (
                <div
                    className={styles.sidebarOverlay}
                    onClick={() => setSidebarOpen(false)}
                />
            )}

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
                    <div className={styles.headerLeft}>
                        <button
                            className={styles.menuButton}
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            title="Ouvrir les conversations"
                        >
                            ☰
                        </button>
                    </div>
                    <div className={styles.headerContent}>
                        <h1>Ollama</h1>
                        <p>Votre compagnon intelligent pour toutes vos questions</p>
                    </div>
                    <div className={styles.headerButtons}>
                        <button
                            className={styles.themeToggle}
                            onClick={() => setIsDarkMode(!isDarkMode)}
                            title={isDarkMode ? "Passer en mode clair" : "Passer en mode sombre"}
                        >
                            {isDarkMode ? '☀️' : '🌙'}
                        </button>
                    </div>
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
                    {/* Afficher les fichiers uploadés */}
                    {uploadedFiles.length > 0 && (
                        <div className={styles.uploadedFilesContainer}>
                            {uploadedFiles.map((file, index) => (
                                <div key={index} className={styles.uploadedFile}>
                                    <span className={styles.fileName}>{file.name}</span>
                                    <button
                                        onClick={() => removeFile(index)}
                                        className={styles.removeFileButton}
                                        type="button"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                    <form onSubmit={handleSubmit} className={styles.formContainer}>
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept=".pdf,.png,.jpg,.jpeg"
                            onChange={handleFileUpload}
                            style={{ display: 'none' }}
                        />
                        <button
                            type="button"
                            onClick={openFilePicker}
                            className={styles.uploadButton}
                            disabled={isThinking}
                            title="Ajouter un fichier (PDF, PNG, JPEG)"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                        </button>
                        <button
                            type="button"
                            onClick={() => setUseWebSearch(!useWebSearch)}
                            className={`${styles.webSearchButton} ${useWebSearch ? styles.webSearchActive : ''}`}
                            disabled={isThinking}
                            title={useWebSearch ? "Recherche web activée" : "Activer la recherche web"}
                        >
                            🌍
                        </button>
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
                </div>
            </div>
        </main>
    );
}