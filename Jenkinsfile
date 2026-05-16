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

        stage('Install Dependencies') {
            steps {
                sh 'npm ci'
            }
        }

        stage('Test & Lint') {
            steps {
                echo 'Skipping test phase for now...'
                // If you want to enable testing, add tests command here:
                // sh 'npm run test -- --watch=false --browsers=ChromeHeadless'
            }
        }

        stage('Docker Build') {
            steps {
                script {
                    echo "Building Docker image ${DOCKER_IMAGE}:${DOCKER_TAG}..."
                    dockerImage = docker.build("${DOCKER_IMAGE}:${DOCKER_TAG}")
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
                sh "docker run -d -p 8080:80 --name hms-frontend ${DOCKER_IMAGE}:${DOCKER_TAG}"
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
