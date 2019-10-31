import { checkHeader } from "../../src/policies/access-restriction";
import { Router } from "express";
import { Metadata } from "../../src/endpoint";

export const postsRouter = Router();

postsRouter.get("/", (req, res) => res.status(200));
postsRouter.get(
  "/:id/:commentId",
  checkHeader({
    "failed-check-error-message": "ewrfewrf",
    "failed-check-httpcode": 400,
    "header-name": "",
    "ignore-case": true
  }),
  () => {},
  (req, res) => res.status(200)
);

postsRouter.post("/", (req, res) => res.status(200));
postsRouter.post("/:id", Metadata.set({ displayName: "HELLO" }), (req, res) =>
  res.status(200)
);

postsRouter.delete("/:id", (req, res) => res.status(200));
