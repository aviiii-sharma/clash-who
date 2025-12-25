import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import "./App.css";

function App() {
  const [socket, setSocket] = useState(null);
  
  // Game State
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [gameState, setGameState] = useState("home");
  const [isHost, setIsHost] = useState(false);
  
  // Gameplay Data
  const [characters, setCharacters] = useState([]);
  const [hasSelected, setHasSelected] = useState(false);
  const [currentTurn, setCurrentTurn] = useState(null);
  const [eliminated, setEliminated] = useState({});
  const [guessCandidate, setGuessCandidate] = useState(null);
  const [previewCard, setPreviewCard] = useState(null);

  useEffect(() => {
    const BACKEND_URL =
      import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

    const s = io(BACKEND_URL);
    setSocket(s);

    s.on("room-created", ({ roomCode }) => {
      setRoomCode(roomCode);
      setIsHost(true);
      setGameState("waiting");
    });

    s.on("player-joined", ({ status, hostId }) => {
      setGameState(status);
      setIsHost(s.id === hostId);
    });

    s.on("topic-chosen", ({ characters, status }) => {
      setCharacters(characters);
      setGameState(status);
    });

    s.on("start-game", ({ currentTurn }) => {
      setCurrentTurn(currentTurn);
      setGameState("playing");
    });

    s.on("turn-changed", ({ currentTurn }) => {
      setCurrentTurn(currentTurn);
    });

    s.on("game-ended", ({ winner, reason }) => {
      const msg = reason === "both-wrong" 
        ? "😵 Both guessed wrong!" 
        : `🎉 ${winner} WINS!`;
      alert(msg);
      setGameState("finished");
    });

    s.on("reset-to-topic", () => {
      setGameState("topic-selection");
      setCharacters([]);
      setHasSelected(false);
      setEliminated({});
      setGuessCandidate(null);
      setPreviewCard(null);
    });

    return () => s.disconnect();
  }, []);

  const myKey = isHost ? "p1" : "p2";
  const isMyTurn = currentTurn === myKey;

  return (
    <div className="container">
      
      {/* --- HOME SCREEN --- */}
      {gameState === "home" && (
        <div className="container center-screen">
          <img 
            src="/images/logo.png" 
            alt="Clash Who Logo" 
            className="game-logo" 
          />

          <input
            className="game-input"
            placeholder="ENTER YOUR NAME"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
          />

          <button
            className="btn-3d btn-yellow"
            onClick={() => socket.emit("create-room", { playerName })}
          >
            Create Game
          </button>

          <div style={{ margin: "15px 0", color: "#64748B", fontWeight: "bold" }}>OR</div>

          <input
            className="game-input"
            placeholder="ROOM CODE"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            style={{ letterSpacing: "4px", textTransform: "uppercase" }}
          />

          <button
            className="btn-3d btn-blue"
            onClick={() => socket.emit("join-room", { roomCode, playerName })}
          >
            Join Game
          </button>
        </div>
      )}

      {/* --- WAITING LOBBY --- */}
      {gameState === "waiting" && (
        <div className="container center-screen">
          <h2 className="pick-header">Lobby</h2>
          
          <div 
            className="room-code-display"
            onClick={() => {
              navigator.clipboard.writeText(roomCode);
              alert("Copied!");
            }}
          >
            {roomCode}
          </div>
          <p className="subtitle">Tap code to copy</p>
          <p style={{ marginTop: 20, fontSize: "1.2rem", animation: "pulse 2s infinite" }}>
            Waiting for Player 2...
          </p>
        </div>
      )}

      {/* --- TOPIC SELECTION --- */}
      {gameState === "topic-selection" && (
        <div className="container center-screen">
          <h2 className="pick-header">Select Arena</h2>
          
          {isHost ? (
            <div className="topic-grid">
              {[
                { 
                  key: "clash-royale", 
                  name: "Clash Royale", 
                  img: "/images/topics/clash-royale.jpg" 
                },
                { 
                  key: "celebrities", 
                  name: "Celebrities", 
                  img: "/images/topics/celebrities.jpg" 
                },
              ].map((t) => (
                <div
                  key={t.key}
                  className="topic-card"
                  onClick={() => socket.emit("choose-topic", { roomCode, topic: t.key })}
                >
                  <img
                    src={`${import.meta.env.BASE_URL}${t.img.replace(/^\//, "")}`}
                    alt={t.name}
                  />
                  <div className="topic-name">{t.name}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="subtitle">Waiting for Host...</div>
          )}
        </div>
      )}

      {/* --- CHARACTER SELECT --- */}
      {gameState === "selecting" && (
        <div className="container" style={{ padding: 10 }}>
          <h2 className="pick-header" style={{ textAlign: "center" }}>
            Pick Your Card
          </h2>
          
          {!hasSelected ? (
            <div className="game-area">
              <div className="character-grid">
                {characters.map((c) => (
                  <div
                    key={c.id}
                    className="char-card"
                    onClick={() => {
                      socket.emit("select-character", { roomCode, characterId: c.id });
                      setHasSelected(true);
                    }}
                  >
                    <img
                      src={`${import.meta.env.BASE_URL}${c.image.replace(/^\//, "")}`}
                      alt={c.name}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="container center-screen">
              <div style={{ fontSize: "5rem", marginBottom: "20px" }}>✅</div>
              <h2 style={{ fontSize: "2rem" }}>Card Selected!</h2>
              <p className="subtitle">Waiting for opponent...</p>
            </div>
          )}
        </div>
      )}

      {/* --- MAIN GAMEPLAY --- */}
      {gameState === "playing" && (
        <>
          <div className={`turn-banner ${isMyTurn ? "bg-green" : "bg-gray"}`}>
            {isMyTurn ? "YOUR TURN" : "OPPONENT'S TURN"}
          </div>

          <div className="game-area">
            <div className="character-grid">
              {characters.map((c) => {
                const isEliminated = eliminated[c.id];
                const isSelected = guessCandidate === c.id;

                return (
                  <div
                    key={c.id}
                    className={`char-card ${isEliminated ? "eliminated" : ""} ${isSelected ? "selected-guess" : ""}`}
                    onClick={() => {
                      if (!isMyTurn || previewCard) return;
                      // Toggle elimination
                      setEliminated(prev => ({ ...prev, [c.id]: !prev[c.id] }));
                      // Set as guess candidate
                      setGuessCandidate(c.id);
                    }}
                    // Long press / click for preview
                    onTouchStart={(e) => {
                       e.currentTarget.pressTimer = setTimeout(() => setPreviewCard(c), 400);
                    }}
                    onTouchEnd={(e) => clearTimeout(e.currentTarget.pressTimer)}
                    onMouseDown={(e) => {
                       e.currentTarget.pressTimer = setTimeout(() => setPreviewCard(c), 400);
                    }}
                    onMouseUp={(e) => clearTimeout(e.currentTarget.pressTimer)}
                  >
                    <img src={c.image} alt={c.name} loading="lazy" />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="controls-area">
            <button
              className={`btn-3d ${!isMyTurn ? "btn-disabled" : "btn-blue"}`}
              disabled={!isMyTurn}
              onClick={() => socket.emit("end-turn", { roomCode })}
            >
              End Turn
            </button>

            <button
              className={`btn-3d ${(!isMyTurn || !guessCandidate) ? "btn-disabled" : "btn-yellow"}`}
              disabled={!isMyTurn || !guessCandidate}
              onClick={() => socket.emit("make-guess", { roomCode, characterId: guessCandidate })}
            >
              Guess
            </button>
          </div>
        </>
      )}

      {/* --- PREVIEW MODAL (CARD INFO STYLE) --- */}
      {previewCard && (
        <div className="modal-overlay" onClick={() => setPreviewCard(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-img-container">
              <img
                src={`${import.meta.env.BASE_URL}${previewCard.image.replace(/^\//, "")}`}
                alt={previewCard.name}
                style={{ width: "100%", height: "auto", display: "block" }}
              />
            </div>
            
            <div className="modal-rarity">Legendary</div>
            <h2 className="modal-title">{previewCard.name}</h2>
            
            <div style={{ marginTop: "20px" }}>
              <button 
                className="btn-3d btn-red"
                onClick={() => setPreviewCard(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;