const pool = require('./dbCockroachConfig');
const bcrypt = require('bcrypt');

const createTables = async () => {
  const client = await pool.connect();
  try {
    const createUserTable = `
      CREATE TABLE IF NOT EXISTS "nuruser" (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE,
        password VARCHAR(100),
        email VARCHAR(255),
        role STRING CHECK (role IN ('user', 'admin')) DEFAULT 'user',
        google_id VARCHAR(255) UNIQUE
      );
    `;

    const createCoursesTable = `
      CREATE TABLE IF NOT EXISTS courses (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255),
        description TEXT,
        admin_id INT,
        likes_count INT DEFAULT 0
      );
    `;

    const createLikesTable = `
      CREATE TABLE IF NOT EXISTS likes (
        id SERIAL PRIMARY KEY,
        user_id INT,
        course_id INT
      );
    `;

    const createVideosTable = `
      CREATE TABLE IF NOT EXISTS videos (
        id SERIAL PRIMARY KEY,
        path VARCHAR(255),
        productionPath VARCHAR(150),
        filename VARCHAR(100),
        admin_id INT
      );
    `;

    const createFilesTable = `
      CREATE TABLE IF NOT EXISTS files (
        id SERIAL PRIMARY KEY,
        path VARCHAR(255),
        filename VARCHAR(100),
        filetype VARCHAR(50),
        admin_id INT
      );
    `;

    const createCourseVideosTable = `
      CREATE TABLE IF NOT EXISTS course_videos (
        course_id INT,
        video_id INT,
        PRIMARY KEY (course_id, video_id)
      );
    `;

    await client.query(createUserTable);
    await client.query(createCoursesTable);
    await client.query(createLikesTable);
    await client.query(createVideosTable);
    await client.query(createFilesTable);
    await client.query(createCourseVideosTable);

    console.log('Tables created successfully');

    // Insert admin user if not exists
    const adminUsername = 'massiveAnalizer';
    const adminPassword = 'zetrax10P';
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    const checkAdminExistsQuery = `SELECT COUNT(*) FROM "nuruser" WHERE username = $1`;
    const insertAdminQuery = `
      INSERT INTO "nuruser" (username, password, role)
      VALUES ($1, $2, 'admin')
      ON CONFLICT (username) DO NOTHING;
    `;

    const res = await client.query(checkAdminExistsQuery, [adminUsername]);
    const count = res.rows[0].count;

    if (count == 0) {
      await client.query(insertAdminQuery, [adminUsername, hashedPassword]);
      console.log('Admin user created successfully');
    } else {
      console.log('Admin user already exists');
    }

  } catch (err) {
    console.error('Error creating tables or inserting admin user:', err);
  } finally {
    client.release();
  }
};

module.exports = createTables;

