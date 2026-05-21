"use client";

import { useState, useRef, useEffect } from "react";
import { Play, Pause, RotateCcw, Volume2, VolumeX, Maximize2 } from "lucide-react";

function fmt(s: number) {
  if (!isFinite(s)) return "0:00";
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

export function DemoVideo() {
  const videoRef             = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying]   = useState(false);
  const [muted,   setMuted]     = useState(true);
  const [time,    setTime]      = useState(0);
  const [duration, setDuration] = useState(0);
  const [started, setStarted]   = useState(false);
  const [ended,   setEnded]     = useState(false);
  const [hovering, setHovering] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime  = () => setTime(v.currentTime);
    const onMeta  = () => setDuration(v.duration);
    const onPlay  = () => { setPlaying(true);  setEnded(false); };
    const onPause = () => setPlaying(false);
    const onEnded = () => { setPlaying(false); setEnded(true); };
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("play",  onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("ended", onEnded);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("play",  onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("ended", onEnded);
    };
  }, []);

  const handlePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (!started) setStarted(true);
    if (ended) { v.currentTime = 0; setEnded(false); }
    v.play();
  };

  const handlePause = () => videoRef.current?.pause();

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    const r   = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - r.left) / r.width;
    v.currentTime = Math.max(0, Math.min(duration, pct * duration));
    if (!started) { setStarted(true); }
  };

  const handleRestart = () => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    setEnded(false);
    v.play();
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  const handleFullscreen = () => {
    const v = videoRef.current;
    if (!v) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else v.requestFullscreen?.();
  };

  const progress = duration ? (time / duration) * 100 : 0;
  const showControls = hovering || !playing || ended;

  return (
    <div
      className="w-full rounded-2xl overflow-hidden border border-white/[0.1] shadow-2xl shadow-black/70 bg-black group"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {/* Video element */}
      <div className="relative" style={{ aspectRatio: "16/9" }}>
        <video
          ref={videoRef}
          src="/demo.webm"
          muted={muted}
          playsInline
          preload="metadata"
          className="w-full h-full object-cover"
          onClick={playing ? handlePause : handlePlay}
          style={{ cursor: "pointer" }}
        />

        {/* Play button overlay — shown when not started or paused */}
        {(!started || (!playing && !ended)) && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px] cursor-pointer"
            onClick={handlePlay}
          >
            {/* Ambient glow */}
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-brand-500/40 blur-2xl scale-150" />
              <div className="relative w-18 h-18 w-[72px] h-[72px] rounded-full bg-white/15 border border-white/30 flex items-center justify-center hover:bg-white/25 hover:scale-105 transition-all duration-200 shadow-2xl">
                <Play className="w-7 h-7 fill-white text-white ml-1" />
              </div>
            </div>
            {!started && (
              <div className="absolute bottom-6 text-center">
                <p className="text-white text-sm font-semibold mb-1">Watch the demo</p>
                <p className="text-gray-400 text-xs">
                  4 queries · EC2 count, S3 audit, IAM roles, SSH exposure
                </p>
                <div className="flex items-center justify-center gap-2 mt-2">
                  {["EC2", "S3", "IAM", "SSH"].map(l => (
                    <span key={l} className="text-[10px] text-gray-400 bg-white/[0.07] border border-white/[0.1] rounded px-2 py-0.5 font-mono">{l}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Ended overlay */}
        {ended && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm gap-4">
            <p className="text-white font-semibold">Demo complete</p>
            <p className="text-gray-400 text-sm">4 queries across EC2, S3, IAM, Security Groups</p>
            <button
              onClick={handleRestart}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors shadow-lg shadow-brand-500/30"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Watch again
            </button>
          </div>
        )}
      </div>

      {/* Controls bar — fades in on hover */}
      <div
        className={`bg-black/80 backdrop-blur-sm px-4 pt-2.5 pb-3 transition-opacity duration-200 ${showControls ? "opacity-100" : "opacity-0"}`}
      >
        {/* Seekbar */}
        <div
          className="h-1 bg-white/10 rounded-full mb-3 cursor-pointer group/seek relative"
          onClick={handleSeek}
        >
          <div
            className="h-full bg-gradient-to-r from-brand-500 to-violet-500 rounded-full relative"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-md opacity-0 group-hover/seek:opacity-100 transition-opacity" />
          </div>
        </div>

        {/* Button row */}
        <div className="flex items-center gap-3">
          {/* Play/Pause */}
          <button
            onClick={playing ? handlePause : handlePlay}
            className="text-white hover:text-brand-400 transition-colors"
          >
            {playing
              ? <Pause className="w-4 h-4 fill-white" />
              : <Play  className="w-4 h-4 fill-white ml-0.5" />}
          </button>

          {/* Restart */}
          <button
            onClick={handleRestart}
            className="text-gray-600 hover:text-white transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Mute */}
          <button onClick={toggleMute} className="text-gray-600 hover:text-white transition-colors">
            {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>

          {/* Timestamp */}
          <span className="text-xs font-mono text-gray-500">{fmt(time)} / {fmt(duration)}</span>

          <div className="flex-1" />

          {/* Fullscreen */}
          <button onClick={handleFullscreen} className="text-gray-600 hover:text-white transition-colors">
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          <span className="text-[10px] uppercase tracking-widest text-gray-700 font-medium ml-1">
            CloudMind · Demo
          </span>
        </div>
      </div>
    </div>
  );
}
