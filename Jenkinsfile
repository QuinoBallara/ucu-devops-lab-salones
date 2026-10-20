pipeline {
  agent any

  // La configuración del equipo vive en k8s/config.env (fuente única de verdad).
  // Se carga en la etapa "Load config" y queda disponible como variables de entorno.
  environment {
    REGISTRY = 'docker.io'
  }

  options {
    timestamps()
    disableConcurrentBuilds()
  }

  triggers {
    // Se dispara ante cambios en la rama principal (webhook o sondeo).
    pollSCM('H/5 * * * *')
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Load config') {
      steps {
        script {
          // Exporta las variables de k8s/config.env a la pipeline.
          def cfg = readFile('k8s/config.env')
            .readLines()
            .findAll { it.trim() && !it.trim().startsWith('#') }
            .collect { it.trim() }
          def vars = cfg.collect { line ->
            def (k, v) = line.split('=', 2)
            "${k.trim()}=${v.trim()}"
          }.join('\n')
          writeFile file: '.pipeline.env', text: vars + '\n'
          vars.readLines().each { line ->
            def (k, v) = line.split('=', 2)
            env."${k.trim()}" = v.trim()
          }
          echo "Config cargada: namespace=${env.NAMESPACE} host=${env.INGRESS_HOST} user=${env.DOCKERHUB_USER}"
        }
      }
    }

    stage('Test backend') {
      steps {
        dir('backend') {
          sh 'npm ci'
          sh 'npm test'
        }
      }
    }

    stage('Build frontend') {
      steps {
        dir('frontend') {
          sh 'npm ci'
          sh 'npm run build'
        }
      }
    }

    stage('Docker build & push') {
      steps {
        script {
          def tag = env.GIT_COMMIT ? env.GIT_COMMIT.take(7) : env.BUILD_NUMBER
          env.IMAGE_TAG = tag
          withCredentials([usernamePassword(credentialsId: 'dockerhub-credentials',
                                            usernameVariable: 'DH_USER',
                                            passwordVariable: 'DH_PASS')]) {
            sh """
              echo "\$DH_PASS" | docker login -u "\$DH_USER" --password-stdin
              docker build -t ${env.BACKEND_IMAGE}:${tag} -t ${env.BACKEND_IMAGE}:latest ./backend
              docker build -t ${env.FRONTEND_IMAGE}:${tag} -t ${env.FRONTEND_IMAGE}:latest ./frontend
              docker push ${env.BACKEND_IMAGE}:${tag}
              docker push ${env.BACKEND_IMAGE}:latest
              docker push ${env.FRONTEND_IMAGE}:${tag}
              docker push ${env.FRONTEND_IMAGE}:latest
            """
          }
        }
      }
    }

    stage('Deploy') {
      steps {
        withCredentials([file(credentialsId: 'kubeconfig-ucu', variable: 'KUBECONFIG')]) {
          script {
            sh "kubectl apply -f k8s/00-namespace.yaml"
            sh "kubectl apply -f k8s/01-secret.yaml"
            sh "kubectl apply -f k8s/02-pvc.yaml"
            sh "kubectl apply -f k8s/03-backend.yaml"
            sh "kubectl apply -f k8s/04-frontend.yaml"
            sh "kubectl apply -f k8s/05-ingress.yaml"
            sh "kubectl -n ${env.NAMESPACE} set image deployment/backend backend=${env.BACKEND_IMAGE}:${IMAGE_TAG}"
            sh "kubectl -n ${env.NAMESPACE} set image deployment/frontend frontend=${env.FRONTEND_IMAGE}:${IMAGE_TAG}"
            sh "kubectl -n ${env.NAMESPACE} rollout status deployment/backend --timeout=120s"
            sh "kubectl -n ${env.NAMESPACE} rollout status deployment/frontend --timeout=120s"
          }
        }
      }
    }
  }

  post {
    success {
      echo "Desplegado. URL: http://${env.INGRESS_HOST}"
    }
    failure {
      echo "La pipeline falló. Revisar el log de la etapa correspondiente."
    }
  }
}
