import { useRef } from "react";
import { useState } from "react";
import { Menu } from "./menu/Menu";
import { Game } from "./game/Game";

export const App = () => {
  const [screen, setScreen] = useState("menu");
  const clientRef = useRef(null);

  const switchToMenu = () => setScreen("menu");
  const switchToGame = (client) => {
    clientRef.current = client;
    setScreen("game");
  };

  return (
    <>
      {screen === "menu" && (
        <Menu switchToMenu={switchToMenu} switchToGame={switchToGame} />
      )}
      {screen === "game" && <Game client={clientRef.current} />}
    </>
  );
};
