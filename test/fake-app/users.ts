import { Router } from "express";
import { Policy } from "../../src/endpoint";

export const usersRouter = Router();

usersRouter.get("/me", (req, res) => res.status(200));
usersRouter.get("/:id", (req, res) => res.status(200));

usersRouter.use(
  Policy.create("post method only", "backend"),
  Policy.create("post method only again", "backend")
);
usersRouter.post("/", (req, res) => res.status(200));
usersRouter.post("/:id", (req, res) => res.status(200));
