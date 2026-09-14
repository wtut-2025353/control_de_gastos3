import { Router } from "express";
import { getAllUsers, getMe, updateMe, changeMyPassword, changeRole } from "../controllers/user.controller.js";
import { authenticate } from "../../../middleware/auth.middleware.js";
import { authorizeAdmin } from "../../../middleware/role.middleware.js";

const router = Router();

router.get("/me", authenticate, getMe);
router.put("/me", authenticate, updateMe);
router.put("/me/password", authenticate, changeMyPassword);
router.get("/", authenticate, authorizeAdmin, getAllUsers);
router.put("/:id/role", authenticate, authorizeAdmin, changeRole);

export default router;