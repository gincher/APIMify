import { Router } from "express";

export const postsRouter = Router();

postsRouter.get("/", (req, res) => res.status(200));
postsRouter.get("/:id/:commentId", () => {}, (req, res) => res.status(200));

postsRouter.post("/", (req, res) => res.status(200));
postsRouter.post("/:id", (req, res) => res.status(200));

postsRouter.delete("/:id", (req, res) => res.status(200));
