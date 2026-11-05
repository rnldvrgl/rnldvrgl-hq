"use client";

import { MUSIC_STYLES, useSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { SoundMixer } from "../SoundMixer";
import { Card, Group, SwitchRow } from "./kit";

export function SoundPage() {
    return <Sound />;
}

function Sound() {
    const music = useSettings((s) => s.music);
    const setMusic = useSettings((s) => s.setMusic);
    const musicStyle = useSettings((s) => s.musicStyle);
    const setMusicStyle = useSettings((s) => s.setMusicStyle);
    const chimes = useSettings((s) => s.chimes);
    const setChimes = useSettings((s) => s.setChimes);
    return (
        <>
        <Group title="Music" hint="Heard only when the office sound is on (the speaker button, top right).">
            <Card>
            <SwitchRow label="Office music" hint="Through the speakers and subwoofer, 8 AM – 7 PM" checked={music} onChange={setMusic} />
            <SwitchRow label="Who-needs-you chimes" hint="Each employee has their own little tune when they need you" checked={chimes} onChange={setChimes} />
            </Card>
            {music && (
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Music style">
                    {MUSIC_STYLES.map((m) => (
                        <button
                            key={m.id}
                            type="button"
                            role="radio"
                            aria-checked={musicStyle === m.id}
                            onClick={() => setMusicStyle(m.id)}
                            className={cn(
                                "grid min-h-12 rounded-2xl border px-3 py-2 text-left leading-tight transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring",
                                musicStyle === m.id ? "border-ring bg-accent/70 ring-1 ring-ring" : "border-border bg-card/40",
                            )}
                        >
                            <span className="text-sm font-semibold">{m.label}</span>
                            <span className="text-[11px] text-muted-foreground">{m.hint}</span>
                        </button>
                    ))}
                </div>
            )}
        </Group>
        <Group title="Volume" hint="Each kind of sound on its own slider.">
            <div className="grid grid-cols-[minmax(0,1fr)] rounded-2xl border border-border bg-card/60 p-3">
                <SoundMixer />
            </div>
        </Group>
        </>
    );
}

