"use client"; // Required for Next.js since we need the browser window for physics

import { useEffect, useRef } from "react";
import Matter from "matter-js";

export default function HangingTags() {
  const sceneRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);

  useEffect(() => {
    if (!sceneRef.current) return;

    // 1. Setup the Engine and World
    const engine = Matter.Engine.create();
    engineRef.current = engine;
    const world = engine.world;

    // 2. Setup the Renderer
    const render = Matter.Render.create({
      element: sceneRef.current,
      engine: engine,
      options: {
        width: window.innerWidth,
        height: window.innerHeight,
        wireframes: false, // Set to true if you want to see the bare collision hitboxes
        background: "transparent",
      },
    });

    // 3. Create the Hanging Tags (Rectangles)
    // parameters: x, y, width, height, options
    const tagOptions = {
      restitution: 0.8, // Bounciness
      frictionAir: 0.02, // Air resistance
      render: { fillStyle: "#1D1D1F" }, // Dark tag color
    };

    const dashboardTag = Matter.Bodies.rectangle(window.innerWidth * 0.3, 200, 150, 60, tagOptions);
    const sitesTag = Matter.Bodies.rectangle(window.innerWidth * 0.5, 200, 150, 60, tagOptions);
    const aiTag = Matter.Bodies.rectangle(window.innerWidth * 0.7, 200, 150, 60, tagOptions);

    // 4. Create the Constraints (The "Strings" holding the tags)
    // We pin them to points at the top of the screen (y: 0)
    const createString = (body: Matter.Body, pinX: number) => {
      return Matter.Constraint.create({
        pointA: { x: pinX, y: -50 }, // Point in the sky
        bodyB: body,                 // The tag
        pointB: { x: 0, y: -30 },    // Top center of the tag
        stiffness: 0.01,             // The "swing" factor. Lower = looser
        damping: 0.05,
        render: { strokeStyle: "#aaaaaa", lineWidth: 2 },
      });
    };

    const string1 = createString(dashboardTag, window.innerWidth * 0.3);
    const string2 = createString(sitesTag, window.innerWidth * 0.5);
    const string3 = createString(aiTag, window.innerWidth * 0.7);

    // 5. Add Mouse Interaction (The fun part)
    const mouse = Matter.Mouse.create(render.canvas);
    const mouseConstraint = Matter.MouseConstraint.create(engine, {
      mouse: mouse,
      constraint: {
        stiffness: 0.2,
        render: { visible: false },
      },
    });

    // 6. Add everything to the world
    Matter.World.add(world, [
      dashboardTag, sitesTag, aiTag,
      string1, string2, string3,
      mouseConstraint,
    ]);

    // 7. Run the Engine and Renderer
    Matter.Runner.run(Matter.Runner.create(), engine);
    Matter.Render.run(render);

    // 8. Cleanup on unmount (Crucial for React Strict Mode)
    return () => {
      Matter.Render.stop(render);
      Matter.World.clear(world, false);
      Matter.Engine.clear(engine);
      render.canvas.remove();
      render.canvas = null as any;
      render.context = null as any;
      render.textures = {};
    };
  }, []);

  return (
    <div 
      ref={sceneRef} 
      className="fixed inset-0 pointer-events-auto z-50 overflow-hidden"
    />
  );
}