// Sprint 3 - StudyBuddy Application
// Author: Maywon
// Implements all Sprint 3 required pages

"use strict";

const express = require("express");
const path    = require("path");
const db      = require("./services/db");

const app = express();

app.set("view engine", "pug");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "../static")));
app.use(express.urlencoded({ extended: true }));

// ── Root ─────────────────────────────────────────────────────────
app.get("/", function (req, res) {
  res.render("index", { title: "StudyBuddy – Find Your Study Partner" });
});

// ── Users list page ──────────────────────────────────────────────
// Requirement: Users list page using data pulled from database
app.get("/users", async function (req, res) {
  try {
    const rows = await db.query(`
      SELECT  u.user_id,
              CONCAT(u.first_name, ' ', u.last_name) AS full_name,
              u.academic_level,
              d.name  AS department,
              uni.name AS university
      FROM    user u
      JOIN    department d   ON d.department_id  = u.department_id
      JOIN    university uni ON uni.university_id = u.university_id
      ORDER   BY u.first_name ASC
    `);
    res.render("users", { title: "Study Buddies Directory", users: rows });
  } catch (err) {
    console.error(err);
    res.status(500).send("Unable to fetch users");
  }
});

// ── User profile page ────────────────────────────────────────────
// Requirement: User profile page using data pulled from database
app.get("/users/:id", async function (req, res) {
  try {
    const uid  = req.params.id;
    const [user] = await db.query(
      `SELECT u.user_id, u.first_name, u.last_name, u.email,
              u.academic_level, u.bio, u.created_at,
              d.name AS department, uni.name AS university
       FROM   user u
       JOIN   department d   ON d.department_id  = u.department_id
       JOIN   university uni ON uni.university_id = u.university_id
       WHERE  u.user_id = ?`,
      [uid]
    );
    if (!user) return res.status(404).render("error", { message: "User not found" });

    const skills  = await db.query(
      `SELECT s.skill_name, us.proficiency_level
       FROM   user_skill us JOIN skill s ON s.skill_id = us.skill_id
       WHERE  us.user_id = ?`, [uid]
    );
    const courses = await db.query(
      `SELECT c.course_code, c.course_name, e.semester, e.year
       FROM   enrollment e JOIN course c ON c.course_id = e.course_id
       WHERE  e.user_id = ?`, [uid]
    );
    res.render("profile", {
      title: `${user.first_name} ${user.last_name} – Profile`,
      user, skills, courses
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Unable to fetch user profile");
  }
});

// ── Listing page ─────────────────────────────────────────────────
// Requirement: Listing page using data pulled from database
app.get("/sessions", async function (req, res) {
  try {
    const { tag } = req.query;
    const params  = [];
    let   sql     = `
      SELECT ss.session_id, ss.topic, ss.location,
             DATE_FORMAT(ss.scheduled_time, '%D %M %Y, %H:%i') AS formatted_time,
             ss.max_participants,
             u.first_name, u.last_name,
             COUNT(sp.user_id) AS participants_joined
      FROM   study_session     ss
      JOIN   user              u  ON u.user_id  = ss.created_by
      LEFT JOIN session_participant sp ON sp.session_id = ss.session_id
    `;
    if (tag) { sql += " WHERE ss.topic LIKE ?"; params.push(`%${tag}%`); }
    sql += " GROUP BY ss.session_id ORDER BY ss.scheduled_time ASC";

    const sessions = await db.query(sql, params);
    res.render("sessions", { title: "All Study Sessions", sessions, selectedTag: tag });
  } catch (err) {
    console.error(err);
    res.status(500).send("Unable to fetch sessions");
  }
});

// ── Detail page ──────────────────────────────────────────────────
// Requirement: Detail page using data pulled from database
app.get("/sessions/:id", async function (req, res) {
  try {
    const sid = req.params.id;
    const [session] = await db.query(
      `SELECT ss.session_id, ss.topic, ss.location,
              DATE_FORMAT(ss.scheduled_time, '%D %M %Y, %H:%i') AS formatted_time,
              ss.max_participants, u.first_name, u.last_name, u.user_id AS organiser_id
       FROM   study_session ss
       JOIN   user u ON u.user_id = ss.created_by
       WHERE  ss.session_id = ?`,
      [sid]
    );
    if (!session) return res.status(404).render("error", { message: "Session not found" });

    const participants = await db.query(
      `SELECT u.user_id, u.first_name, u.last_name, sp.status
       FROM   session_participant sp
       JOIN   user u ON u.user_id = sp.user_id
       WHERE  sp.session_id = ?`, [sid]
    );
    res.render("session-detail", { title: session.topic, session, participants });
  } catch (err) {
    console.error(err);
    res.status(500).send("Unable to fetch session details");
  }
});

// ── Tags / Categories ────────────────────────────────────────────
// Requirement: Tags/categories page using data pulled from database
app.get("/tags", async function (req, res) {
  try {
    const tags = await db.query(
      `SELECT topic AS tag, COUNT(*) AS session_count
       FROM   study_session
       GROUP  BY topic
       ORDER  BY session_count DESC`
    );
    res.render("tags", { title: "Browse by Topic", tags });
  } catch (err) {
    console.error(err);
    res.status(500).send("Unable to fetch topics");
  }
});

app.listen(3000, function () {
  console.log("StudyBuddy running at http://127.0.0.1:3000/");
});
