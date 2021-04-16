// -----------------------------
// File: index.js
// Author: Paulo Bruno B. Corá
// Date: 15/04/2021
// Brief: Falarya app main board scene;
// -----------------------------

// -------------------------
// Import dependencies;
const phaser = require("phaser");

// Import assets;
const background = require("../../assets/img/background.gif");
const ground = require("../../assets/img/ground.png");
const playerSprite = require("../../assets/img/player.png");
const partnerSprite = require("../../assets/img/partner.png");
const enemySprite = require("../../assets/img/skeleton.png");
const io = require("socket.io-client");
// -------------------------

// -------------------------
// Define scene;
class board extends phaser.Scene {
  constructor() {
    super({ key: "Board" });

    this.layers = [
      { tag: "background", src: background, type: "background" },
      { tag: "ground", src: ground, type: "ground" },
    ];

    this.players = [];
    this.teamHealthPoints = 30;
  }

  // -------------------------
  // Preload scene resources method;
  preload() {
    this.layers.forEach((layer) => this.load.image(layer.tag, layer.src));

    this.load.spritesheet("player", playerSprite, {
      frameWidth: 24,
      frameHeight: 18,
    });

    this.load.spritesheet("partner", partnerSprite, {
      frameWidth: 24,
      frameHeight: 18,
    });

    this.load.spritesheet("enemy", enemySprite, {
      frameWidth: 14,
      frameHeight: 31,
    });
  }
  // -------------------------

  // -------------------------
  // Create scene main method;
  create() {
    this.listenToServer();
    this.mountSceneScreen();
    this.player = this.addPlayerToScreen();
  }
  // -------------------------

  // -------------------------
  // update scene main method;
  update() {
    this.handlePlayerMovement();

    if (this.teamHealthPoints <= 0) {
      this.socket.emit("game_over");
      this.socket.disconnect();
      this.scene.start("GameOver");
    }
  }
  // -------------------------

  // -------------------------
  // Mount screen configs method;
  mountSceneScreen() {
    // Define screen layers;
    this.layers.forEach((layer) => {
      layer.type === "background" &&
        this.add.image(0, 0, layer.tag).setScale(2);
    });

    // Add ground;
    this.platforms = this.physics.add.staticGroup();

    this.platforms.create(400, 720, "ground").setScale(1).refreshBody();

    this.playRect = this.add
      .rectangle(680, 385, 200, 100, "black", 70)
      .setInteractive()
      .on("pointerdown", () => {
        this.socket.emit("start_horde");
        this.playButton.destroy();
        this.playRect.destroy();
      });
    this.playButton = this.add
      .text(640, 360, "Play", {
        font: "50px Verdana",
      })
      .setInteractive()
      .on("pointerdown", () => {
        this.socket.emit("start_horde");
        this.playButton.destroy();
        this.playRect.destroy();
      });

    this.teamHealth = this.add.text(
      30,
      100,
      `Health Points: ${this.teamHealthPoints}`,
      {
        font: "30px Verdana",
      }
    );
  }
  // -------------------------

  // -------------------------
  // Mount screen configs method;
  addPlayerToScreen(id) {
    const player = this.physics.add
      .sprite(300, 100, id ? "partner" : "player")
      .setScale(2)
      .setBounce(0.3)
      .setGravityY(600)
      .setCollideWorldBounds(true);

    this.physics.add.collider(player, this.platforms);

    id && this.players.push({ id: id, player: player });

    return player;
  }
  // -------------------------

  // -------------------------
  // Mount screen configs method;
  addEnemyToScreen(speed) {
    const enemy = this.physics.add
      .sprite(speed, 0, "enemy")
      .setScale(2)
      .setBounce(0.3)
      .setGravityY(600)
      .setVelocityX(200)
      .setCollideWorldBounds(true);

    this.physics.add.collider(enemy, this.platforms);
    this.physics.add.collider(enemy, this.player, () => {
      this.socket.emit("damage_taken");
    });

    this.players.map((player) => {
      this.physics.add.collider(enemy, player.player);
    });

    return enemy;
  }
  // -------------------------

  // -------------------------
  // Mount screen configs method;
  handlePlayerMovement() {
    document.addEventListener("keydown", (keydown) => {
      if (!keydown.repeat)
        switch (keydown.key) {
          case "ArrowLeft":
            this.player.setVelocityX(-200);
            this.socket.emit("player_moved", {
              id: this.socket.id,
              move: "player_moved_left",
            });
            break;
          case "ArrowRight":
            this.player.setVelocityX(200);
            this.socket.emit("player_moved", {
              id: this.socket.id,
              move: "player_moved_right",
            });
            break;
          case "ArrowUp":
            this.player.body.touching.down && this.player.setVelocityY(2000);
            this.socket.emit("player_moved", {
              id: this.socket.id,
              move: "player_jumped",
            });
        }
    });

    document.addEventListener("keyup", (event) => {
      event.key !== "ArrowUp" && this.player.setVelocityX(0);
      this.socket.emit("player_moved", {
        id: this.socket.id,
        move: "player_stopped",
      });
    });
  }
  // -------------------------

  // -------------------------
  // Listen to server events method;
  listenToServer() {
    this.socket = io("127.0.0.1:7014", {
      path: "/api/websocket/real-time",
    });

    this.socket.on("connection", (event) => {
      socket.emit("add_player");
    });

    this.socket.on("add_player", (event) => {
      event.socketid.map((id) => {
        this.addPlayerToScreen(id);
      });
    });

    this.socket.on("remove_player", (event) => {
      this.removePlayerFromScreen(event);
    });

    this.socket.on("player_moved", (event) => {
      this.handleMultiplayerMovement(event);
    });

    this.socket.on("created_enemy", (event) => {
      this.addEnemyToScreen(event.speed);
    });

    this.socket.on("damage_taken", (event) => {
      this.teamHealth.destroy();
      this.teamHealthPoints -= 1;
      this.teamHealth = this.add.text(
        30,
        100,
        `Health Points: ${this.teamHealthPoints}`,
        {
          font: "30px Verdana",
        }
      );
    });

    setInterval(() => {
      this.socket.emit("player_moved", {
        id: this.socket.id,
        move: "player_replaced",
        x: this.player.body.x,
        y: this.player.body.y,
      });
    }, 2000);
  }

  // -------------------------
  removePlayerFromScreen(id) {
    const leaverIndex = this.players.findIndex((item) => item.id === id);
    this.players[leaverIndex].player.destroy();
    this.players.splice(leaverIndex, 1);
  }
  // -------------------------

  handleMultiplayerMovement(event) {
    const movedPlayerIndex = this.players.findIndex(
      (item) => item.id === event.id
    );

    switch (event.move) {
      case "player_moved_right":
        this.players[movedPlayerIndex].player.setVelocityX(200);
        break;
      case "player_moved_left":
        this.players[movedPlayerIndex].player.setVelocityX(-200);
        break;
      case "player_jumped":
        this.players[movedPlayerIndex].player.setVelocityY(2000);
        break;
      case "player_stopped":
        this.players[movedPlayerIndex].player.setVelocityX(0);
        break;
      case "player_replaced":
        this.players[movedPlayerIndex].player.setX(event.x).setY(event.y + 20);
        break;
    }
  }
}
// -------------------------
// -------------------------
module.exports = board;
// -------------------------