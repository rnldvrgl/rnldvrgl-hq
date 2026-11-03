"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useOffice } from "@/lib/store";
import { IsoScene } from "@/components/IsoScene";
import { LoadingScreen } from "./LoadingScreen";

const Scene3D = dynamic(() => import("./Scene3D"), {
  ssr: false,
  loading: () => <LoadingScreen compact label="Opening the office" />,
});

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/** 3D office when the device supports WebGL, the flat isometric SVG otherwise. */
export function OfficeScene() {
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const data = useOffice((s) => s.data);
  const selected = useOffice((s) => s.selected);
  const select = useOffice((s) => s.select);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => setWebgl(hasWebGL()), []);
  useEffect(() => {
    if (webgl !== false) return;
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, [webgl]);

  if (webgl === null) return <LoadingScreen compact label="Opening the office" />;
  if (!webgl) return <IsoScene state={data} selected={selected} onSelect={select} now={now} />;
  return <Scene3D />;
}
