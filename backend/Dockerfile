# Use a lightweight Java 21 runtime environment
FROM eclipse-temurin:26-jre-jammy

WORKDIR /app

# Copy the compiled JAR file from your local target folder into the container
COPY target/*.jar app.jar

# Expose the port your Spring Boot app runs on
EXPOSE 8080

# Run the application
ENTRYPOINT ["java", "-jar", "app.jar"]
