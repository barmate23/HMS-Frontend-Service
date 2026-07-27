pipeline {
    agent any

    environment {
        DOCKER_IMAGE = "barmate23/hms-frontend-service"
        DOCKER_TAG   = "latest"
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Clean Old Container and Image') {
            steps {
                echo "Cleaning up old containers and images for ${DOCKER_IMAGE}..."
                sh """
                    # Stop and remove existing container if present
                    docker stop hms-frontend || true
                    docker rm -f hms-frontend || true

                    # Delete all previous images matching ${DOCKER_IMAGE}
                    docker rmi -f \$(docker images -q ${DOCKER_IMAGE}) || true
                    docker rmi -f ${DOCKER_IMAGE}:${DOCKER_TAG} || true

                    # Remove dangling images
                    docker image prune -f || true
                """
            }
        }

        stage('Docker Build') {
            steps {
                echo "Building new Docker image ${DOCKER_IMAGE}:${DOCKER_TAG}..."
                sh "docker build -t ${DOCKER_IMAGE}:${DOCKER_TAG} ."
            }
        }

        stage('Deploy') {
            steps {
                echo "Deploying ${DOCKER_IMAGE}:${DOCKER_TAG}..."
                sh "docker run -d --restart unless-stopped --network host --name hms-frontend ${DOCKER_IMAGE}:${DOCKER_TAG}"
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
