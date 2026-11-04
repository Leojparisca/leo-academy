"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type MidiStatus = "idle" | "requesting" | "ready" | "denied" | "unsupported";

type MidiHandlers = {
  onNoteOn: (midi: number, velocity: number) => void;
  onNoteOff: (midi: number) => void;
  onSustain: (on: boolean) => void;
};

const hasMidi = () =>
  typeof navigator !== "undefined" && "requestMIDIAccess" in navigator;

/**
 * Web MIDI over USB-OTG. The permission prompt waits for the first gesture so
 * merely opening the studio never interrupts the student; after that every
 * connected keyboard is wired automatically, including hot-plugging.
 */
export function useMidiInput(handlers: MidiHandlers, enabled = true) {
  const [status, setStatus] = useState<MidiStatus>("idle");
  const [devices, setDevices] = useState<string[]>([]);
  const accessRef = useRef<MIDIAccess | null>(null);
  const handlersRef = useRef(handlers);
  const heldRef = useRef<Set<number>>(new Set());
  const enabledRef = useRef(enabled);

  handlersRef.current = handlers;
  enabledRef.current = enabled;

  const releaseHeld = useCallback(() => {
    for (const midi of heldRef.current) handlersRef.current.onNoteOff(midi);
    heldRef.current.clear();
    handlersRef.current.onSustain(false);
  }, []);

  const bind = useCallback(
    (access: MIDIAccess) => {
      const names: string[] = [];
      for (const input of access.inputs.values()) {
        names.push(input.name?.trim() || "Teclado MIDI");
        input.onmidimessage = (event: MIDIMessageEvent) => {
          if (!enabledRef.current) return;
          const data = event.data;
          if (!data || data.length < 3) return;
          const command = data[0] & 0xf0;
          const note = data[1];
          const value = data[2];
          if (command === 0x90 && value > 0) {
            heldRef.current.add(note);
            handlersRef.current.onNoteOn(note, Math.max(0.1, value / 127));
          } else if (command === 0x80 || (command === 0x90 && value === 0)) {
            heldRef.current.delete(note);
            handlersRef.current.onNoteOff(note);
          } else if (command === 0xb0 && note === 64) {
            handlersRef.current.onSustain(value >= 64);
          } else if (command === 0xb0 && (note === 120 || note === 123)) {
            releaseHeld();
          }
        };
      }
      setDevices(names);
      setStatus("ready");
    },
    [releaseHeld],
  );

  const connect = useCallback(async () => {
    if (!enabledRef.current) return;
    if (accessRef.current) {
      bind(accessRef.current);
      return;
    }
    if (!hasMidi()) {
      setStatus("unsupported");
      return;
    }
    setStatus("requesting");
    try {
      const access = await navigator.requestMIDIAccess({ sysex: false });
      accessRef.current = access;
      access.onstatechange = () => {
        if (!enabledRef.current) return;
        releaseHeld();
        bind(access);
      };
      bind(access);
    } catch {
      setStatus("denied");
    }
  }, [bind, releaseHeld]);

  useEffect(() => {
    if (!hasMidi()) {
      setStatus("unsupported");
      return;
    }
    if (!enabled) return;

    let fired = false;
    const trigger = () => {
      if (fired) return;
      fired = true;
      void connect();
    };
    window.addEventListener("pointerdown", trigger, { once: true, capture: true });
    window.addEventListener("keydown", trigger, { once: true, capture: true });
    return () => {
      window.removeEventListener("pointerdown", trigger, true);
      window.removeEventListener("keydown", trigger, true);
    };
  }, [connect, enabled]);

  useEffect(() => {
    if (!enabled) releaseHeld();
  }, [enabled, releaseHeld]);

  useEffect(() => {
    return () => {
      const access = accessRef.current;
      if (access) {
        access.onstatechange = null;
        for (const input of access.inputs.values()) {
          input.onmidimessage = null;
        }
      }
    };
  }, []);

  return {
    status,
    devices,
    supported: status !== "unsupported",
    connect,
  };
}

export type { MidiStatus };
