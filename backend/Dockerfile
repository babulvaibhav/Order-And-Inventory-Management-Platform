# Build stage
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
# pom.xml copied and dependencies resolved before the source tree, so `docker build` reuses this
# layer (and its downloaded dependency cache) whenever only the source changes.
COPY pom.xml .
RUN mvn -B dependency:go-offline
COPY src ./src
RUN mvn -B clean package -DskipTests

# Run stage
FROM eclipse-temurin:21-jre
WORKDIR /app

# curl: needed by docker-compose.yml's own healthcheck for this service (the base image doesn't
# carry it). Runs as root previously — a container escape or a dependency RCE would then run as
# root on the host's container runtime. See KNOWN_LIMITATIONS.md "Addressed in this pass".
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system app && useradd --system --gid app --home-dir /app app \
    && mkdir -p /app/keys && chown -R app:app /app
COPY --from=build --chown=app:app /app/target/*.jar app.jar
USER app

EXPOSE 8080
# No HEALTHCHECK here: docker-compose.yml already defines one for this service (curl against
# /actuator/health), and this image doesn't carry curl/wget to duplicate it without adding a
# dependency just for that. Running this image outside that compose file won't get a healthcheck.
ENTRYPOINT ["java", "-jar", "app.jar"]
