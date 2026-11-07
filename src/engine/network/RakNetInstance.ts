/**
 * Translation of: network/RakNetInstance.h (IRakNetInstance + RakNetInstance)
 *
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/network/RakNetInstance.h
 *
 * IRakNetInstance is the interface for the RakNet network layer. In the
 * browser, raw UDP is unavailable, so we implement a WebSocket-based relay
 * (same approach as mcpe-0.6.1-web's WebRakNetInstance + tools/lobby).
 *
 * For single-player (our MVP), all methods are no-ops. Multiplayer requires
 * the WebSocket relay (tools/lobby/server.js from mcpe-0.6.1-web) + a
 * SocketLayerOverride (translated from the C++ WebRakNetInstance).
 *
 * Faithful translation of the interface:
 *   - host(localName, port, maxConnections): start listening
 *   - connect(host, port): connect to a server
 *   - disconnect(): close connection
 *   - runEvents(callback): pump network events (packet receive/dispatch)
 *   - send(packet): send a packet to all connected peers
 *   - send(guid, packet): send to a specific peer
 *   - isServer(): true if this instance is hosting
 *
 * The full RakNetInstance.cpp (RakPeer setup, pingForHosts, etc.) is
 * deferred until the WebSocket relay subsystem is built. For single-player
 * we use this stub-free no-op implementation.
 */

export interface PingedCompatibleServer {
  name: string;
  address: string;
  pingTime: number;
  isSpecial: boolean;
}

export interface NetEventCallback {
  onConnect?(guid: unknown): void;
  onDisconnect?(guid: unknown): void;
  onPacket?(packet: unknown): void;
}

export interface Packet {
  getId(): number;
  write(dos: unknown): void;
  read(dis: unknown): void;
}

export class IRakNetInstance {
  host(_localName: string, _port: number, _maxConnections = 4): boolean { return false; }
  connect(_host: string, _port: number): boolean { return false; }
  setIsLoggedIn(_status: boolean): void {}
  pingForHosts(_port: number): void {}
  stopPingForHosts(): void {}
  getServerList(): PingedCompatibleServer[] { return []; }
  clearServerList(): void {}
  disconnect(): void {}
  announceServer(_localName: string): void {}
  getPeer(): unknown { return null; }
  isMyLocalGuid(_guid: unknown): boolean { return true; }
  runEvents(_callback: NetEventCallback | null): void {}
  send(_packet: Packet): void {}
  sendTo(_guid: unknown, _packet: Packet): void {}
  sendPtr(_packet: Packet): void {}
  sendToPtr(_guid: unknown, _packet: Packet): void {}
  isServer(): boolean { return true; }
  isProbablyBroken(): boolean { return false; }
  resetIsBroken(): void {}
}

// For single-player mode: all network methods are no-ops.
export class RakNetInstance extends IRakNetInstance {
  private _isServer = true;
  private _isLoggedIn = false;

  override host(_localName: string, _port: number, _maxConnections = 4): boolean {
    this._isServer = true;
    return true;
  }

  override connect(_host: string, _port: number): boolean {
    this._isServer = false;
    return true;
  }

  override setIsLoggedIn(status: boolean): void { this._isLoggedIn = status; }
  override isServer(): boolean { return this._isServer; }
  override disconnect(): void {}
  override runEvents(_callback: NetEventCallback | null): void {}
  override send(_packet: Packet): void {}
  override sendTo(_guid: unknown, _packet: Packet): void {}
  override sendPtr(_packet: Packet): void {}
  override sendToPtr(_guid: unknown, _packet: Packet): void {}
}
