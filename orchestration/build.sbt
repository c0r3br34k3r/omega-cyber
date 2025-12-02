// build.sbt
// ==============================================================================
// OMEGA PLATFORM - ORCHESTRATION SERVICE BUILD DEFINITION
// ==============================================================================
//
// This file defines the build configuration for the Omega Orchestration Service,
// a critical component responsible for managing the lifecycle and interactions
// of various microservices within the Omega Platform. It leverages the Akka
// ecosystem for building highly concurrent, distributed, and fault-tolerant
// systems.
//

// --- Project Metadata ---
ThisBuild / version := "0.2.0"
ThisBuild / scalaVersion := "2.13.12"
ThisBuild / organization := "io.omega.orchestration"
ThisBuild / organizationName := "Omega Platform Engineering"
ThisBuild / startYear := Some(2023)
ThisBuild / licenses := Seq("AGPL-3.0-or-later" -> url("https://www.gnu.org/licenses/agpl-3.0.en.html"))
ThisBuild / homepage := Some(url("https://omega-cyber.io/docs/orchestration"))

// --- Common Settings for all projects ---
lazy val commonSettings = Seq(
  scalacOptions ++= Seq(
    "-encoding", "UTF-8", // Specify character encoding
    "-deprecation",        // Emit warning and location for usages of deprecated APIs
    "-feature",             // Emit warning and location for usages of features that should be imported explicitly
    "-unchecked",           // Enable additional warnings where generated code depends on assumptions
    "-Xlint",               // Enable recommended additional warnings
    "-Ywarn-unused",        // Warn when local and private vals, vars, defs, types, and imports are unused
    "-Ywarn-dead-code",     // Warn when dead code is identified
    "-Wdead-code",          // More warnings for dead code
    "-Wvalue-discard",      // Warn when non-Unit expression results are discarded
    "-Wextra-implicit",     // Warn when an implicit conversion could be confusing
    "-Wunused:implicits",   // Warn when implicit parameters are unused
    // "-Xfatal-warnings",     // Make all warnings fatal (useful for CI/CD)
    "-Ypartial-unification",// Enable partial unification in type constructor inference
    "-Wunused:patvars,privates,imports", // Fine-grained unused warnings
  ),
  javaOptions ++= Seq(
    "-Dakka.cluster.sharding.verbose-debug-logging=on", // Akka debug logging
    "-Dakka.remote.artery.advanced.aeron.log-level=WARN", // Aeron logging
    // "-XX:+HeapDumpOnOutOfMemoryError", // Generate heap dump on OOM
    // "-Xms2g", "-Xmx4g" // Initial and max heap size
  ),
  // Fork a new JVM for 'run' command to avoid classloader issues
  // with Akka applications and hot-reloading.
  fork := true,
  Test / fork := true, // Fork a new JVM for tests as well

  // Resolvers for dependencies
  resolvers ++= Seq(
    Resolver.mavenLocal,
    "Lightbend Charts" at "https://repo.akka.io/snapshots/",
    "Sonatype OSS Snapshots" at "https://oss.sonatype.org/content/repositories/snapshots",
    "Confluent" at "https://packages.confluent.io/maven/" // For Akka Kafka connector
  ),
  // Enable Akka gRPC code generation
  Compile / PB.targets := Seq(
    scalapb.gen(grpc = true) -> (Compile / sourceManaged).value
  )
)

// --- Root Project ---
lazy val orchestration = project.in(file("."))
  .settings(
    name := "omega-orchestration-service",
    description := "The central orchestration and management service for the Omega Platform. Built with Akka Cluster for distributed, fault-tolerant microservice coordination.",
    commonSettings,
    libraryDependencies ++= Seq(
      // --- Akka Ecosystem: Core for distributed systems ---
      "com.typesafe.akka" %% "akka-actor-typed"            % AkkaVersion,
      "com.typesafe.akka" %% "akka-cluster-typed"          % AkkaVersion,
      "com.typesafe.akka" %% "akka-cluster-sharding-typed" % AkkaVersion,
      "com.typesafe.akka" %% "akka-persistence-typed"      % AkkaVersion,
      "com.typesafe.akka" %% "akka-persistence-query"      % AkkaVersion,
      "com.typesafe.akka" %% "akka-stream"                 % AkkaVersion,
      "com.typesafe.akka" %% "akka-http"                   % AkkaHttpVersion,

      // --- Akka gRPC: High-performance communication ---
      "com.lightbend.akka.grpc" %% "akka-grpc-runtime"     % AkkaGrpcVersion,
      "com.lightbend.akka.grpc" %% "akka-grpc-codegen"     % AkkaGrpcVersion % "protobuf",

      // --- Akka Persistence: Event Sourcing & CQRS ---
      // Requires a persistent journal. For production, use Cassandra, RDBMS, or Kafka.
      // For simplicity/dev, use a file-based journal (leveldb or in-mem).
      "com.typesafe.akka" %% "akka-persistence-jdbc"       % AkkaPersistenceJdbcVersion,
      "org.postgresql"    %  "postgresql"                  % PostgreSQLDriverVersion, // For production database
      // "com.typesafe.akka" %% "akka-persistence-inmemory" % AkkaVersion, // For local dev/tests

      // --- Messaging & Event Sourcing (Kafka) ---
      "com.typesafe.akka" %% "akka-stream-kafka"           % AkkaStreamKafkaVersion,

      // --- Metrics & Monitoring ---
      "io.kamon"          %% "kamon-bundle"                % KamonVersion,
      "io.kamon"          %% "kamon-system-metrics"        % KamonVersion,
      "io.kamon"          %% "kamon-prometheus"            % KamonVersion,

      // --- Logging ---
      "com.typesafe.akka" %% "akka-slf4j"                  % AkkaVersion,
      "ch.qos.logback"    %  "logback-classic"             % LogbackVersion,

      // --- Configuration ---
      "com.typesafe"      %  "config"                      % TypesafeConfigVersion,

      // --- Testing ---
      "org.scalatest"     %% "scalatest"                   % ScalaTestVersion % Test,
      "com.typesafe.akka" %% "akka-actor-testkit-typed"    % AkkaVersion % Test,
      "com.typesafe.akka" %% "akka-stream-testkit"         % AkkaVersion % Test,
      "com.typesafe.akka" %% "akka-http-testkit"           % AkkaHttpVersion % Test,
      "org.mockito"       %% "mockito-scala-scalatest"     % MockitoScalaVersion % Test
    )
  )
  .enablePlugins(
    JavaAppPackaging,      // For creating runnable JARs/scripts
    DockerPlugin,           // For Docker image generation
    AkkaGrpcPlugin          // For Akka gRPC features
  )

// --- Versions ---
val AkkaVersion                = "2.8.5"
val AkkaHttpVersion            = "10.6.1"
val AkkaGrpcVersion            = "2.3.0" // Ensure compatibility with Akka/Scala versions
val AkkaPersistenceJdbcVersion = "5.3.0"
val AkkaStreamKafkaVersion     = "4.0.0"
val ScalaTestVersion           = "3.2.17"
val LogbackVersion             = "1.4.11"
val TypesafeConfigVersion      = "1.4.2"
val KamonVersion               = "2.6.0"
val PostgreSQLDriverVersion    = "42.6.0"
val MockitoScalaVersion        = "1.17.29"