"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { agi } from "@/app/providers";

export default function AppSplash() {
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        // Splash is shown until the app has actually hydrated & painted.
        // On a slow connection/device this stays up longer (which is the point);
        // on a fast one it just flashes briefly.
        const t = setTimeout(() => setVisible(false), 450);
        return () => clearTimeout(t);
    }, []);

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 9999,
                        background: agi[950],
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 16,
                    }}
                >
                    <motion.div
                        animate={{ scale: [1, 1.08, 1] }}
                        transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
                        style={{
                            width: 56,
                            height: 56,
                            borderRadius: 14,
                            background: "#fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: `0 0 0 6px ${agi[800]}66`,
                        }}
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/favicon.ico" alt="Logo" width={32} height={32} />
                    </motion.div>
                    <div style={{ color: agi[300], fontSize: 13, letterSpacing: 0.4 }}>
                        Memuat Project Management…
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
