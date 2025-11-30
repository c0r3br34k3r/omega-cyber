// Scala build file for orchestration
// Example:
lazy val root = (project in file(".")).
  settings(
    name := "orchestration",
    version := "0.1",
    scalaVersion := "2.13.8",
    libraryDependencies += "org.scalatest" %% "scalatest" % "3.2.16" % Test
  )

