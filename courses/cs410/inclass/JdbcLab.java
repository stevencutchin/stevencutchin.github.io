/* =====================================================================
 * CS 410/510 Databases - Fall 2026
 * JdbcLab.java - connecting Java to the UNIVERSITY database
 *
 * In-class live session, part two.
 *
 * This file contains every program from the slides, as separate methods.
 * Run it and all five demos execute in order.
 *
 * BEFORE YOU RUN IT:
 *   1. The university database must exist. If it does not, run
 *      university_bootstrap.sql first.
 *   2. Set PASS below to your own MySQL root password.
 *   3. You need mysql-connector-j-9.7.0.jar. Put it in a lib/ folder
 *      next to this file.
 *
 * COMPILE AND RUN:
 *   macOS / Linux
 *     javac -cp lib/mysql-connector-j-9.7.0.jar JdbcLab.java
 *     java  -cp .:lib/mysql-connector-j-9.7.0.jar JdbcLab
 *
 *   Windows  (note the semicolon and the backslashes)
 *     javac -cp lib\mysql-connector-j-9.7.0.jar JdbcLab.java
 *     java  -cp .;lib\mysql-connector-j-9.7.0.jar JdbcLab
 *
 * If you get "No suitable driver found", the jar is not on the
 * classpath - that is a -cp problem, not a problem with this code.
 * ===================================================================== */

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Types;

public class JdbcLab {

    // ---- connection settings -----------------------------------------
    // If the connection is refused over public key retrieval, append:
    //   ?allowPublicKeyRetrieval=true&useSSL=false
    // That is acceptable for a local teaching database and nowhere else.
    static final String URL  = "jdbc:mysql://localhost:3306/university";
    static final String USER = "root";
    static final String PASS = "your-password";

    public static void main(String[] args) throws SQLException {
        testConnection();

        try (Connection conn = DriverManager.getConnection(URL, USER, PASS)) {
            banner("2. Walking a ResultSet - watch Henry Patel's GPA");
            listStudentsBroken(conn);

            banner("3. The same loop, with wasNull()");
            listStudentsFixed(conn);

            banner("4. SQL injection: string-building vs PreparedStatement");
            System.out.println("-- unsafe, honest input \"CS\"");
            findByMajorUnsafe(conn, "CS");
            System.out.println("\n-- unsafe, crafted input \"' OR '1'='1\"");
            findByMajorUnsafe(conn, "' OR '1'='1");
            System.out.println("\n-- safe, same crafted input");
            findByMajorSafe(conn, "' OR '1'='1");

            banner("5. Writing data, and being refused by a constraint");
            addEnrollment(conn);
        }
    }

    // ---- 1. prove the connection works --------------------------------
    static void testConnection() {
        banner("1. Connecting");
        try (Connection conn = DriverManager.getConnection(URL, USER, PASS)) {
            System.out.println("Connected to: " + conn.getCatalog());
            System.out.println("Server:       "
                    + conn.getMetaData().getDatabaseProductVersion());
            System.out.println("Driver:       "
                    + conn.getMetaData().getDriverName() + " "
                    + conn.getMetaData().getDriverVersion());
        } catch (SQLException e) {
            // Print all three. The message alone often hides the real cause.
            System.err.println("Connection failed: " + e.getMessage());
            System.err.println("SQLState: " + e.getSQLState()
                             + "   vendor code: " + e.getErrorCode());
            System.exit(1);
        }
    }

    // ---- 2. the cursor loop, with the NULL bug still in it -------------
    static void listStudentsBroken(Connection conn) throws SQLException {
        String sql = "SELECT StudentID, Name, Major, GPA "
                   + "FROM STUDENT ORDER BY StudentID";

        try (Statement st = conn.createStatement();
             ResultSet rs = st.executeQuery(sql)) {

            while (rs.next()) {
                String id    = rs.getString("StudentID");
                String name  = rs.getString("Name");
                String major = rs.getString("Major");
                double gpa   = rs.getDouble("GPA");   // SQL NULL arrives as 0.0
                System.out.printf("%-6s %-14s %-5s %.2f%n", id, name, major, gpa);
            }
        }
    }

    // ---- 3. the same loop, asking wasNull() ---------------------------
    static void listStudentsFixed(Connection conn) throws SQLException {
        String sql = "SELECT StudentID, Name, Major, GPA "
                   + "FROM STUDENT ORDER BY StudentID";

        try (Statement st = conn.createStatement();
             ResultSet rs = st.executeQuery(sql)) {

            while (rs.next()) {
                String id    = rs.getString("StudentID");
                String name  = rs.getString("Name");

                String major = rs.getString("Major");
                if (rs.wasNull()) major = "(undeclared)";

                double gpa    = rs.getDouble("GPA");
                // wasNull() reports on the most recent getter, so ask it now
                String gpaOut = rs.wasNull() ? "  --  " : String.format("%6.2f", gpa);

                System.out.printf("%-6s %-14s %-13s %s%n", id, name, major, gpaOut);
            }
        }
    }

    // ---- 4a. UNSAFE: the value is glued into the SQL text --------------
    static void findByMajorUnsafe(Connection conn, String major) throws SQLException {
        String sql = "SELECT Name, Major FROM STUDENT WHERE Major = '" + major + "'";
        System.out.println("   SQL sent: " + sql);

        try (Statement st = conn.createStatement();
             ResultSet rs = st.executeQuery(sql)) {
            int n = 0;
            while (rs.next()) { n++; System.out.println("     " + rs.getString("Name")); }
            System.out.println("   -> " + n + " row(s)");
        }
    }

    // ---- 4b. SAFE: the value travels as a parameter --------------------
    static void findByMajorSafe(Connection conn, String major) throws SQLException {
        String sql = "SELECT Name, Major FROM STUDENT WHERE Major = ?";
        System.out.println("   SQL sent: " + sql + "   [param = " + major + "]");

        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, major);          // parameters are 1-indexed
            try (ResultSet rs = ps.executeQuery()) {
                int n = 0;
                while (rs.next()) { n++; System.out.println("     " + rs.getString("Name")); }
                System.out.println("   -> " + n + " row(s)");
            }
        }
    }

    // ---- 5. a write, then the same write again ------------------------
    static void addEnrollment(Connection conn) {
        String sql = "INSERT INTO ENROLLED_IN (StudentID, CourseID, Grade) "
                   + "VALUES (?, ?, ?)";

        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, "S1008");
            ps.setString(2, "CS410");
            ps.setNull(3, Types.CHAR);        // in progress, no grade yet

            int rows = ps.executeUpdate();
            System.out.println("Inserted " + rows + " row(s).");

            ps.executeUpdate();               // run it again - the PK refuses

        } catch (SQLException e) {
            System.out.println("Refused : " + e.getMessage());
            System.out.println("SQLState: " + e.getSQLState()
                             + "   vendor code: " + e.getErrorCode());
        } finally {
            // put the database back the way we found it
            try (PreparedStatement del = conn.prepareStatement(
                     "DELETE FROM ENROLLED_IN WHERE StudentID=? AND CourseID=?")) {
                del.setString(1, "S1008");
                del.setString(2, "CS410");
                del.executeUpdate();
            } catch (SQLException ignored) { }
        }
    }

    static void banner(String title) {
        System.out.println("\n===== " + title + " =====");
    }
}
