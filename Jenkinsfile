pipeline {
    agent any

    environment {
        DOCKER_IMAGE_TAG = "jenkins-${env.BUILD_NUMBER}"
    }
    
    options {
        disableConcurrentBuilds()
    }

    stages {
        stage('Build') {
            when {
                expression {
                    return !params.PRODUCTION
                }
            }
            agent {
                label 'swarm-manager'
            }
            steps {
                sh 'docker-compose build --parallel'
            }
        }

        stage('Build (PRODUCTION)') {
            when {
                expression {
                    return params.PRODUCTION
                }
            }
            agent {
                label 'swarm-manager'
            }
            steps {
                withEnv([
                    "DOCKER_REGISTRY=${params.PRODUCTION_DOCKER_REGISTRY}",
                    "DOCKER_IMAGE_TAG=${params.PRODUCTION_GITHUB_TAG}"
                ]) {
                    sh 'docker-compose build --parallel'
                } 
            }
        }

        stage('Staging') {
             when {
                expression {
                    return !params.PRODUCTION
                }
            }
            agent {
                label 'swarm-manager'
            }
            steps {

                sh 'docker stack rm streamer4user'
                
                sleep(30)

                // Streamer secrets
                configFileProvider([configFile(fileId: 'streamer_service_config.json', variable: 'SERVICE_CONFIG')]) {
                    sh 'docker secret rm streamer-service-config.json || true'
                    sh 'docker secret create streamer-service-config.json $SERVICE_CONFIG'
                }
                configFileProvider([configFile(fileId: 'streamer_mailer_config.json', variable: 'MAILER_CONFIG')]) {
                    sh 'docker secret rm streamer-mailer-config.json || true'
                    sh 'docker secret create streamer-mailer-config.json $MAILER_CONFIG'
                }

                // Streamer UI secrets
                configFileProvider([configFile(fileId: 'streamer_ui_config.json', variable: 'UI_CONFIG')]) {
                    sh 'docker secret rm streamer-ui-config.json || true'
                    sh 'docker secret create streamer-ui-config.json $UI_CONFIG'
                }
                configFileProvider([configFile(fileId: 'streamer_ui_adconfig.json', variable: 'UI_ADCONFIG')]) {
                    sh 'docker secret rm streamer-ui-adconfig.json || true'
                    sh 'docker secret create streamer-ui-adconfig.json $UI_ADCONFIG'
                }
                configFileProvider([configFile(fileId: 'streamer_ui_ldapscert.crt', variable: 'UI_LDAPSCERT')]) {
                    sh 'docker secret rm streamer-ui-ldapscert.crt || true'
                    sh 'docker secret create streamer-ui-ldapscert.crt $UI_LDAPSCERT'
                }

                withCredentials([
                    usernamePassword (
                        credentialsId: params.STREAMER_UI_DB_CREDENTIALS,
                        usernameVariable: 'STREAMER_UI_DB_USER',
                        passwordVariable: 'STREAMER_UI_DB_PASSWORD'
                    ),
                    usernamePassword (
                        credentialsId: params.STREAMER_UI_DB_READ_ONLY_CREDENTIALS,
                        usernameVariable: 'GRAFANA_USER',
                        passwordVariable: 'GRAFANA_PASSWORD'
                    ),
                    usernamePassword (
                        credentialsId: params.STREAMER_UI_DB_CREDENTIALS,
                        usernameVariable: 'POSTGRES_USER',
                        passwordVariable: 'POSTGRES_PASSWORD'
                    )
                ]) {
                    // Overwrite the env.sh file to be stored later as an artifact
                    script {
                        def statusCode = sh(script: "bash ./print_env.sh > ${WORKSPACE}/env.sh", returnStatus: true)
                        echo "statusCode: ${statusCode}"
                    }

                    // Use the same approach as for production
                    script {
                        def statusCode = sh(script: "bash ./docker-deploy-development.sh", returnStatus: true)
                        echo "statusCode: ${statusCode}"
                    }
                }
            }
        }

        stage('Health check') {
            when {
                expression {
                    return !params.PRODUCTION
                }
            }
            agent {
                label 'swarm-manager'
            }
            steps {
                withDockerContainer(image: 'jwilder/dockerize', args: '--network streamer4user-net') {
                    sh (
                        label: 'Waiting for services to become available',
                        script: 'dockerize \
                            -timeout 120s \
                            -wait tcp://service:3001 \
                            -wait http://ui-db:5432 \
                            -wait http://ui:9000'
                    )
                }
            }
            post {
                failure {
                    sh (
                        label: 'Displaying service status',
                        script: 'docker stack ps streamer4user'
                    )
                    sh (
                        label: 'Displaying service logs',
                        script: 'docker stack services --format \'{{.Name}}\' streamer4user | xargs -n 1 docker service logs'
                    )
                }
            }
        }

        stage('Tag and push (PRODUCTION)') {
            when {
                expression {
                    return params.PRODUCTION
                }
            }
            steps {
                echo "production: true"
                echo "production github tag: ${params.PRODUCTION_GITHUB_TAG}"

                // Handle Github tags
                withCredentials([
                    usernamePassword (
                        credentialsId: params.GITHUB_CREDENTIALS,
                        usernameVariable: 'GITHUB_USERNAME',
                        passwordVariable: 'GITHUB_PASSWORD'
                    )
                ]) {
                    // Remove local tag (if any)
                    script {
                        def statusCode = sh(script: "git tag --list | grep ${params.PRODUCTION_GITHUB_TAG}", returnStatus: true)
                        if(statusCode == 0) {
                            sh "git tag -d ${params.PRODUCTION_GITHUB_TAG}"
                            echo "Removed existing local tag ${params.PRODUCTION_GITHUB_TAG}"
                        }
                    }
                    
                    // Create local tag
                    sh "git tag -a ${params.PRODUCTION_GITHUB_TAG} -m 'jenkins'"
                    echo "Created local tag ${params.PRODUCTION_GITHUB_TAG}"

                    // Remove remote tag (if any)
                    script {
                        def result = sh(script: "git ls-remote https://${GITHUB_USERNAME}:${GITHUB_PASSWORD}@github.com/Donders-Institute/data-streamer.git refs/tags/${params.PRODUCTION_GITHUB_TAG}", returnStdout: true).trim()
                        if (result != "") {
                            sh "git push --delete https://${GITHUB_USERNAME}:${GITHUB_PASSWORD}@github.com/Donders-Institute/data-streamer.git ${params.PRODUCTION_GITHUB_TAG}"
                            echo "Removed existing remote tag ${params.PRODUCTION_GITHUB_TAG}"
                        }
                    }

                    // Create remote tag
                    sh "git push https://${GITHUB_USERNAME}:${GITHUB_PASSWORD}@github.com/Donders-Institute/data-streamer.git ${params.PRODUCTION_GITHUB_TAG}"
                    echo "Created remote tag ${params.PRODUCTION_GITHUB_TAG}"
                }

                // Override the env variables and 
                // push the Docker images to the production Docker registry
                withEnv([
                    "DOCKER_REGISTRY=${params.PRODUCTION_DOCKER_REGISTRY}",
                    "DOCKER_IMAGE_TAG=${params.PRODUCTION_GITHUB_TAG}"
                ]) {
                    withCredentials([
                        usernamePassword (
                            credentialsId: params.PRODUCTION_DOCKER_REGISTRY_CREDENTIALS,
                            usernameVariable: 'DOCKER_USERNAME',
                            passwordVariable: 'DOCKER_PASSWORD'
                        )
                    ]) {
                        sh "docker login -u ${DOCKER_USERNAME} -p ${DOCKER_PASSWORD} ${params.PRODUCTION_DOCKER_REGISTRY}"
                        sh 'docker-compose push'
                        echo "Pushed images to ${DOCKER_REGISTRY}"
                    }
                } 
            }
        }
    }

    post {
        success {
            archiveArtifacts "docker-compose.yml, docker-compose.swarm.yml, env.sh"
        }
        always {
            echo 'cleaning'
            sh 'docker system prune -f'
        }
    }
}
