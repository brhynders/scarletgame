export class GameMap {
  constructor(data) {
    this.name = data.name;
    this.tileWidth = data.tileWidth;
    this.tileHeight = data.tileHeight;
    this.cols = data.width;
    this.rows = data.height;
    this.background = data.background;
    this.tileset = data.tileset;
    this.layers = data.layers;
    this.objects = data.objects || [];
    this.pixelWidth = this.cols * this.tileWidth;
    this.pixelHeight = this.rows * this.tileHeight;
  }

  isSolid(col, row) {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return true;
    for (const layer of this.layers) {
      if (!layer.visible) continue;
      if (layer.data[row]?.[col] != null) return true;
    }
    return false;
  }

  getTileAt(col, row) {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return null;
    for (const layer of this.layers) {
      if (!layer.visible) continue;
      const tile = layer.data[row]?.[col];
      if (tile != null) return tile;
    }
    return null;
  }

  pixelToTile(px, py) {
    return {
      col: Math.floor(px / this.tileWidth),
      row: Math.floor(py / this.tileHeight),
    };
  }

  getSpawns(team) {
    return this.objects.filter((obj) => {
      if (obj.type !== "Spawn") return false;
      if (team != null && obj.properties?.Team !== team) return false;
      return true;
    });
  }

  getRandomSpawn(team) {
    const spawns = this.getSpawns(team);
    if (spawns.length === 0) return null;
    return spawns[Math.floor(Math.random() * spawns.length)];
  }
}
