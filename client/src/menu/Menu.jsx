import { NetClient } from "net-client";
import { protocol } from "game-shared";

export const Menu = ({ switchToGame, switchToMenu }) => {
  const connect = () => {
    const client = new NetClient(protocol);
    client.onError = (err) => console.log(err);
    client.onConnect = () => switchToGame(client);
    client.onDisconnect = () => switchToMenu();
    client.connect("ws://localhost:3001");
  };

  return (
    <>
      <button onClick={connect}>Connect to localhost</button>
    </>
  );
};
