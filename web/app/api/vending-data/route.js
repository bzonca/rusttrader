import { NextResponse } from 'next/server';

// Helper function to calculate map size from map data
function calculateMapSize(mapData) {
  const effectiveWidth = mapData.width - (2 * mapData.oceanMargin);
  const effectiveHeight = mapData.height - (2 * mapData.oceanMargin);
  const standardSizes = [1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 5500, 6000];
  const estimatedSize = Math.max(effectiveWidth, effectiveHeight) * 2;
  let closestSize = standardSizes[0];
  let minDiff = Math.abs(estimatedSize - closestSize);

  for (const size of standardSizes) {
    const diff = Math.abs(estimatedSize - size);
    if (diff < minDiff) {
      minDiff = diff;
      closestSize = size;
    }
  }

  return closestSize;
}

export const maxDuration = 30; // Allow up to 30 seconds for Rust+ connections

export async function POST(request) {
  try {
    const server = await request.json();

    if (!server.serverIp || !server.appPort || !server.playerId || !server.playerToken) {
      return NextResponse.json(
        { success: false, error: 'Missing required server fields: serverIp, appPort, playerId, playerToken' },
        { status: 400 }
      );
    }

    const RustPlus = require('@liamcottle/rustplus.js');

    // Create new RustPlus connection
    const rustplus = new RustPlus(server.serverIp, parseInt(server.appPort), server.playerId, server.playerToken);

    // Connect with timeout
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout - server may be offline or unreachable'));
      }, 10000);

      rustplus.once('connected', () => {
        clearTimeout(timeout);
        resolve();
      });

      rustplus.once('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      rustplus.connect();
    });

    // Get server info
    const serverInfo = await new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(null), 5000);
      rustplus.getInfo((response) => {
        clearTimeout(timeout);
        if (response?.response?.info) resolve(response.response.info);
        else if (response?.info) resolve(response.info);
        else resolve(null);
      });
    });

    // Get map data to calculate map size
    const mapInfo = await new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(null), 5000);
      rustplus.getMap((mapData) => {
        clearTimeout(timeout);
        if (mapData?.response?.map) {
          const map = mapData.response.map;
          resolve({ mapSize: calculateMapSize(map), width: map.width, height: map.height, oceanMargin: map.oceanMargin });
        } else {
          resolve(null);
        }
      });
    });

    const mapSize = mapInfo?.mapSize || 4000;

    // Try to get player position
    const playerPosition = await new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(null), 5000);
      rustplus.getTeamInfo((teamInfo) => {
        clearTimeout(timeout);
        if (teamInfo?.response?.error) { resolve(null); return; }
        if (teamInfo?.response?.teamInfo?.members) {
          const members = teamInfo.response.teamInfo.members;
          const you = members.find(m => String(m.steamId) === server.playerId);
          if (you) {
            resolve({ x: you.x - (mapSize / 2), y: you.y - (mapSize / 2), name: you.name, isAlive: you.isAlive });
          } else {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      });
    });

    // Get map markers (vending machines)
    const vendingMachines = await new Promise((resolve) => {
      const timeout = setTimeout(() => resolve([]), 10000);
      rustplus.getMapMarkers((message) => {
        clearTimeout(timeout);
        if (message?.response?.error) { resolve([]); return; }
        if (message?.response?.mapMarkers?.markers) {
          const vending = message.response.mapMarkers.markers
            .filter(marker => marker.type === 3)
            .map(marker => ({
              id: marker.id,
              x: marker.x - (mapSize / 2),
              y: marker.y - (mapSize / 2),
              name: marker.name || 'Vending Machine',
              sellOrders: marker.sellOrders || []
            }));
          resolve(vending);
        } else {
          resolve([]);
        }
      });
    });

    // Disconnect
    rustplus.disconnect();

    return NextResponse.json({
      success: true,
      serverInfo: serverInfo ? {
        name: serverInfo.name || server.serverName || 'Unknown',
        players: serverInfo.players || 0,
        maxPlayers: serverInfo.maxPlayers || 0,
        queuedPlayers: serverInfo.queuedPlayers || 0,
        seed: serverInfo.seed || 0,
        size: serverInfo.size || 0,
        wipeTime: serverInfo.wipeTime || null
      } : {
        name: server.serverName || 'Unknown',
        players: 0, maxPlayers: 0, queuedPlayers: 0, seed: 0, size: 0, wipeTime: null
      },
      mapSize,
      playerPosition,
      vendingMachines
    });

  } catch (error) {
    console.error('Error getting vending data:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
