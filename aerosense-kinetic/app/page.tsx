"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
// 1. Added the 'Map' icon to your lucide-react imports
import { ArrowDown, Wind, ShieldAlert, Activity, Database, LayoutDashboard, Map } from "lucide-react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const LanyardScene = dynamic(() => import("./components/LanyardScene"), { ssr: false });

export default function HomePage() {
  const [showBadge, setShowBadge] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRefs = useRef<(HTMLDivElement | null)[]>([]);
  
  const frameCount = 300; 
  const [images, setImages] = useState<HTMLImageElement[]>([]);

  useEffect(() => {
    const loadedImages: HTMLImageElement[] = [];
    let loadedCount = 0;

    for (let i = 1; i <= frameCount; i++) {
      const img = new Image();
      img.src = `/sequence/ezgif-frame-${i.toString().padStart(3, "0")}.jpg`;
      
      img.onload = () => {
        loadedCount++;
        if (loadedCount === frameCount) {
          setImages(loadedImages);
        }
      };
      loadedImages.push(img);
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current || !canvasRef.current || images.length === 0) return;

    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    if (!context) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const renderFrame = (index: number) => {
      const img = images[index];
      if (!img) return;

      const hRatio = canvas.width / img.width;
      const vRatio = canvas.height / img.height;
      const ratio = Math.max(hRatio, vRatio);
      const centerShift_x = (canvas.width - img.width * ratio) / 2;
      const centerShift_y = (canvas.height - img.height * ratio) / 2;

      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(
        img,
        0, 0, img.width, img.height,
        centerShift_x, centerShift_y, img.width * ratio, img.height * ratio
      );
    };

    renderFrame(0);

    let ctx = gsap.context(() => {
      const playhead = { frame: 0 };

      gsap.to(playhead, {
        frame: frameCount - 1,
        snap: "frame",
        ease: "none",
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.5,
        },
        onUpdate: () => renderFrame(playhead.frame),
      });

      textRefs.current.forEach((section) => {
        if (!section) return;
        gsap.fromTo(
          section.children,
          { opacity: 0, y: 100 },
          {
            opacity: 1, y: 0, duration: 1.2, stagger: 0.2, ease: "expo.out",
            scrollTrigger: {
              trigger: section,
              start: "top 75%", end: "bottom 25%",
              toggleActions: "play reverse play reverse",
            },
          }
        );
      });
    }, containerRef);

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      renderFrame(0);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      ctx.revert();
      window.removeEventListener("resize", handleResize);
    };
  }, [images]);

  const addToRefs = (el: HTMLDivElement) => {
    if (el && !textRefs.current.includes(el)) textRefs.current.push(el);
  };

  return (
    <main ref={containerRef} className="relative w-full bg-black text-white font-sans">
      
      {/* THE CANVAS BACKGROUND */}
      <div className="fixed inset-0 pointer-events-none z-0 bg-black">
        {images.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-gray-500">
            Loading Cinematic Assets...
          </div>
        ) : (
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-40" />
        )}
        
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-black/90" />
        <div className="absolute inset-0 opacity-[0.04] mix-blend-overlay" 
             style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/stardust.png")' }} />
      </div>

      {/* EXPANDED PAGE CONTENT */}
      <div className="relative z-10">

        {/* LANYARD 3D OVERLAY */}
        {showBadge && (
          <div className="fixed inset-0 z-[100] pointer-events-auto bg-black/40 backdrop-blur-sm transition-all">
            <button 
              onClick={() => setShowBadge(false)} 
              className="absolute top-8 right-8 px-6 py-2 bg-white/10 border border-white/20 text-white font-medium rounded-full hover:bg-white hover:text-black transition-all duration-300 z-[101]"
            >
              Close
            </button>
            <LanyardScene />
          </div>
        )}

        {/* 2. UPGRADED NAVBAR: Added the Public Map Button */}
        <nav className="fixed top-0 w-full p-8 flex justify-between items-center z-50 backdrop-blur-md border-b border-white/5 bg-black/20">
          <div className="font-black text-2xl tracking-widest drop-shadow-md">AEROSENSE</div>
          <div className="flex items-center gap-4">
            <Link href="/public-map">
              <button className="hidden md:flex items-center gap-2 px-6 py-2 bg-transparent border border-white/10 text-gray-300 font-medium rounded-full hover:bg-white/10 hover:text-white transition-all duration-300">
                <Map size={16} /> Live Quality Map
              </button>
            </Link>
            <Link href="/login">
              <button className="px-6 py-2 bg-white/10 border border-white/20 font-medium rounded-full hover:bg-white hover:text-black transition-all duration-300">
                Launch Dashboard
              </button>
            </Link>
          </div>
        </nav>

        <section className="h-screen flex flex-col items-center justify-center px-8 text-center">
          <div ref={addToRefs} className="flex flex-col items-center">
            <h1 className="text-7xl md:text-[10rem] font-black tracking-tighter leading-none drop-shadow-2xl">
              Breathe <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-b from-gray-100 to-gray-600">
                Easier.
              </span>
            </h1>
            <p className="mt-8 text-xl md:text-3xl font-light text-gray-400 max-w-3xl">
              Real-time, AI-powered air quality compliance monitoring for the modern urban landscape.
            </p>
          </div>
          <div className="absolute bottom-12 animate-bounce">
            <ArrowDown size={32} className="text-gray-500" />
          </div>
        </section>

        <section className="h-screen flex items-center px-8 md:px-24">
          <div ref={addToRefs} className="max-w-3xl">
            <Activity size={48} className="mb-6 text-red-500 opacity-80" />
            <h2 className="text-5xl md:text-7xl font-black tracking-tighter">
              The Invisible <br /> Threat.
            </h2>
            <p className="mt-8 text-2xl text-gray-400 font-light leading-relaxed">
              PM2.5 particles are small enough to enter the bloodstream. We monitor the unseen risks at construction sites before they become public health crises.
            </p>
          </div>
        </section>

        <section className="h-screen flex items-center justify-end px-8 md:px-24 text-right">
          <div ref={addToRefs} className="max-w-3xl flex flex-col items-end">
            <Wind size={48} className="mb-6 text-emerald-400 opacity-80" />
            <h2 className="text-5xl md:text-7xl font-black tracking-tighter">
              Precision <br /> at the Edge.
            </h2>
            <p className="mt-8 text-2xl text-gray-400 font-light leading-relaxed text-left">
              Our IP65-rated PM2.5 and PM10 sensor nodes are powered by ESP32 microcontrollers. Built to survive and transmit from the harshest industrial environments.
            </p>
          </div>
        </section>

        <section className="h-screen flex items-center px-8 md:px-24">
          <div ref={addToRefs} className="max-w-3xl">
            <Database size={48} className="mb-6 text-blue-400 opacity-80" />
            <h2 className="text-5xl md:text-7xl font-black tracking-tighter">
              Cloud-Native <br /> Scale.
            </h2>
            <p className="mt-8 text-2xl text-gray-400 font-light leading-relaxed">
              Transmitting real-time MQTT payloads directly to AWS IoT Core and Amazon Timestream. Millions of data points, processed with zero latency.
            </p>
          </div>
        </section>

        {/* 3. UPGRADED CTA SECTION: Added dual-action buttons */}
        <section className="h-[80vh] flex flex-col items-center justify-center bg-white/5 backdrop-blur-xl border-t border-white/10 px-8 text-center rounded-t-[4rem] relative overflow-hidden mt-32">
          <h2 className="text-5xl md:text-7xl font-black tracking-tighter drop-shadow-lg">
            Ready to deploy?
          </h2>
          
          <div className="flex flex-col sm:flex-row items-center gap-6 mt-12">
            <Link href="/public-map">
              <button className="flex items-center gap-3 px-10 py-5 bg-white/5 border border-white/10 text-white text-xl font-bold rounded-full hover:bg-white/10 transition-all duration-300">
                <Map size={24} className="text-gray-400" /> View Live Map
              </button>
            </Link>
            
            <button 
              onClick={() => setShowBadge(true)}
              className="px-14 py-5 bg-white text-black text-xl font-bold rounded-full hover:scale-105 transition-transform shadow-[0_0_40px_rgba(255,255,255,0.4)]"
            >
              Contact the Team
            </button>
          </div>
        </section>
        
      </div>
    </main>
  );
}