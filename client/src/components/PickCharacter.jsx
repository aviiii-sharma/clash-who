export default function PickCharacter({ cards, onPick }) {
  if (!cards.length) {
    return <p style={{ textAlign: "center" }}>Loading cards...</p>;
  }

  return (
    <div className="character-grid">
      {cards.map((card) => (
        <div
          key={card.id}
          className="char-card"
          onClick={() => onPick?.(card)}
        >
          <img
            src={`/images/clash-royale/${card.image}`}
            alt={card.name}
            loading="lazy"
          />
          <div className="char-name">{card.name}</div>
        </div>
      ))}
    </div>
  );
}
