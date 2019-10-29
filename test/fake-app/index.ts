import express from "express";
import { usersRouter } from "./users";

export const app = express();

app.get("/", (req, res) => res.status(200));
app.get("/about", (req, res) => res.status(200));
app.get("/contact-us", (req, res) => res.status(200));

app.get("/users", usersRouter);

// app.use();
app.get("/posts");
