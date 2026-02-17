import { useEffect, useRef } from "react";
import Phaser from "phaser";
import { Scene } from "./Scene.js";

export const Game = ({ client }) => {
  const containerRef = useRef(null);
  const gameRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    gameRef.current = new Phaser.Game({
      type: Phaser.AUTO,
      parent: containerRef.current,
      width: 1280,
      height: 720,
      backgroundColor: "#0d1112",
      scale: {
        mode: Phaser.Scale.RESIZE,
      },
      scene: [new Scene(client)],
    });

    return () => {
      gameRef.current?.destroy();
      gameRef.current = null;
    };
  }, []);

  return <div ref={containerRef}></div>;
};
