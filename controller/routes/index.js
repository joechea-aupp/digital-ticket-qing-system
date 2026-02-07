const express = require("express")
const router = express.Router()

router.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" })
})

router.get("/", (req, res) => {
    res.render("index", { title: "WebSocket Server" })
})

router.get("/ticket-queue", (req, res) => {
    res.render("ticket-queue", { title: "Ticket Queue Display" })
})

router.get("/get-ticket", (req, res) => {
    res.render("get-ticket", { title: "Get Your Ticket" })
})

router.get("/admin", (req, res) => {
    res.render("admin", { title: "Admin Panel" })
})

module.exports = router
