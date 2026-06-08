EXAMPLE STRUCTURE:


import express from "express";
import verifyToken from "../middlewares/authMiddleware.js";
import authorizeRoles from "../middlewares/roleMiddleware.js";
import {
    getGamePhase
} from "../controllers/gamePhaseController.js";
import { 
    getLeaderboard,
    getAllResourcesWithheld,
    getFreeLandLeft
} from "../controllers/ogInfoController.js";
import { 
    getEvent 
} from "../controllers/eventsController.js";
import { getMarket } from "../controllers/marketController.js";

const router = new express.Router();

router.get("/gamephase", verifyToken, authorizeRoles("admin", "npc", "moderator", "og"), getGamePhase);
router.get("/events", verifyToken, authorizeRoles("admin", "npc", "moderator", "og"), getEvent);
router.get("/leaderboard", verifyToken, authorizeRoles("admin", "npc", "moderator", "og"), getLeaderboard);
router.get("/allreswithheld", verifyToken, authorizeRoles("admin", "npc", "moderator", "og"), getAllResourcesWithheld);
router.get("/allfreeland", verifyToken, authorizeRoles("admin", "npc", "moderator", "og"), getFreeLandLeft);
router.get("/market", verifyToken, authorizeRoles("admin", "npc", "moderator", "og"), getMarket);

export default router;