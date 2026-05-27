pipeline {
    agent any

    environment {
        // Change these variables as necessary for your registry and naming conventions
        DOCKER_IMAGE = "barmate23/hms-frontend-service"
        DOCKER_TAG = "${env.BUILD_ID}"
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Docker Build') {
            steps {
                script {
                    echo "Building Docker image ${DOCKER_IMAGE}:${DOCKER_TAG}..."
                    def dockerImage = docker.build("${DOCKER_IMAGE}:${DOCKER_TAG}")
                }
            }
        }

        stage('Deploy') {
            steps {
                echo "Deploying ${DOCKER_IMAGE}:${DOCKER_TAG} locally..."
                // Stop and remove the existing container if it exists
                sh "docker stop hms-frontend || true"
                sh "docker rm hms-frontend || true"
                // Run the newly built image
                sh "docker run -d -p 72:72 --name hms-frontend ${DOCKER_IMAGE}:${DOCKER_TAG}"
            }
        }
    }

    post {
        always {
            cleanWs()
        }
        success {
            echo "Pipeline completed successfully!"
        }
        failure {
            echo "Pipeline failed."
        }
    }
}
  
