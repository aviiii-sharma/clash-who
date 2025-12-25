import { useEffect, useState } from "react";
import { CARDS } from "../data/cards";
import { shuffle } from "../utils/shuffle";
import PickCharacter from "../components/PickCharacter";

export default function Room() {
  const [cards, setCards] = useState([]);

  function createRoom() {
    const shuffled = shuffle(CARDS);
    const selectedCards = shuffled.slice(0, 14); // choose how many
    setCards(selectedCards);
  }

  // Auto-generate cards when room loads
  useEffect(() => {
    createRoom();
  }, []);

  return (
    <div className="container">
      <h2 style={{ textAlign: "center" }}>Pick Your Character</h2>
      <PickCharacter cards={cards} />
    </div>
  );
}
