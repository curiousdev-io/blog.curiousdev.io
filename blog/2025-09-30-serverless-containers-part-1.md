---
slug: aws-lambda-container-images-part-1-aws-base-image-for-lambda
title: AWS Lambda Container Images (Part 1 - AWS Base Image for Lambda)
authors: [Brian]
tags: [aws, lambda, container]
---

Your Lambda function just hit the 250MB unzipped size limit.

Again.

You're wrestling with Layers and code dependencies, wondering if there's a better way.

There is — and it might surprise you how simple container packaging makes this problem disappear.

<!--truncate-->

📦 Code Along: This post references a complete working example on [GitHub](https://github.com/curiousdev-io/aws-lambda-container-images/tree/main). Clone it to follow along hands-on.

## Why Use Container Packaging?

AWS Lambda functions can be packaged in either a zip archive or in a container image. What might make a developer choose container packaging?

- **Larger deployment size** Container packages can be up to 10GB - that's much larger than the 50MB (zipped) and 250MB (unzipped) available to zip packaged AWS Lambda functions.

- **Docker workflow** If you and your team already use Docker to build container applications then you may choose to lean into familiar tooling and experience.

- **Dependency management** Containers allow you install OS packages, compile native extensions, and configure your exact runtime.

- **Easier local testing** You can run the exact same image locally as you deploy to AWS.

- **Easier to switch between serverless compute services** I love Lambda and default to using it but, over time, you may not be the right choice for your application. With a little bit of forethought you can minimize the switching costs with container images.

## How to Build AWS Lambda Container Images

There are a few different ways to build out Lambda functions using container imaging. The first is to build upon an AWS base image for Lambda. This will be the focus of this post.

### Step 0: Consider Your Base Image

So...why start with an AWS-provided image? Simple - it includes everything you need to get your function to run. It contains the runtime and, more importantly, the Runtime Interface Client (RIC) - the thing that polls the Lambda Runtime API for events.

Why might you consider _not_ using a AWS base image? That's the subject of later parts to the post series.

### Step 1: Create Your Dockerfile

If you're familiar with Docker already then you'll be familiar with the syntax of the `Dockerfile`. Using a `Dockerfile` for AWS Lambda functions is actually pretty straightforward. Here is a sample one. Even if you're not a Docker expert it's likely you can follow along.

```bash
# AWS provides base images for all supported runtimes
FROM public.ecr.aws/lambda/python:3.13

# LAMBDA_TASK_ROOT is where Lambda expects your code
COPY requirements.txt ${LAMBDA_TASK_ROOT}

RUN pip install -r requirements.txt

COPY src ${LAMBDA_TASK_ROOT}

# This CMD tells Lambda which handler to invoke
# Format: file_name.function_name
CMD [ "lambda_function.handler" ]
```

This snippet is purposefully small. It's done to illustrate the minimal `Dockerfile` you would need. Not included in the snippet is your actual function code. See the [supporting repository](https://github.com/curiousdev-io/aws-lambda-container-images/tree/main) for more detail around the rest of the application.

### Step 2: Local Docker

With the `Dockerfile` and your accompanying code, you can actually run your image locally and experiment with it. AWS provides other mechanisms for zip-packaged Lambda functions (looking at you, AWS SAM CLI) but they're not needed for local containers. Just run your Docker CLI and start the container in the background. 

Here's the magic: AWS Lambda's Runtime Interface Client (included in the base image) implements a local endpoint at port 8080. When you run the container locally, you're hitting this same interface Lambda will use in production.

```bash
docker buildx build --platform linux/arm64 --provenance=false --tag curiousdev-io/python:3.13 .
docker run -p 9000:8080 curiousdev-io/python:3.13 &
```

Once the container is up and running, you can send a HTTP Post to the container:

```bash
curl "http://localhost:9000/2015-03-31/functions/function/invocations" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "2.0",
    "routeKey": "GET /hello",
    "rawPath": "/hello",
    "rawQueryString": "name=Chris",
    "queryStringParameters": {"name": "Chris"},
    "requestContext": {
      "http": {
        "method": "GET",
        "path": "/hello"
      }
    }
  }'
```

Up to this point, you're only using your Docker commands you likely already know and love.

### Step 3: Create the Amazon Elastic Container (ECR) Registry

AWS Lambda functions packaged as containers must be sourced from Amazon ECR. You can use the AWS CLI to create a repository. I'm following the practice of creating a single ECR repository per function.

```bash
aws ecr create-repository --region "$REGION" --repository-name your-repo-name
```

### Step 4: Push the Local Container Image

You should publish the local image to ECR at this point. There are a few things you'll need to do.

* Authenticate Docker to ECR

* Tag the local image with your ECR URI

* Push the image to ECR

```bash
# Authenticate (replace with your region and account ID)
ACCOUNT_NUMBER="123456789012"
AWS_REGION="us-east-1"

aws ecr get-login-password --region ${AWS_REGION} | \
  docker login --username AWS --password-stdin \
  ${ACCOUNT_NUMBER}.dkr.ecr.${AWS_REGION}.amazonaws.com

# Tag for ECR
docker tag curiousdev-io/python:3.13 \
  ${ACCOUNT_NUMBER}.dkr.ecr.${AWS_REGION}.amazonaws.com/your-repo-name:latest

# Push
docker push ${ACCOUNT_NUMBER}.dkr.ecr.${AWS_REGION}$.amazonaws.com/your-repo-name:latest
```

I've automated the entire flow in my [accompanying repo](https://github.com/curiousdev-io/aws-lambda-container-images/blob/main/aws-base-images/python/.config/mise/tasks/publish-image) - check it out to save yourself some typing.


### Step 5: Build and Deploy Your Serverless Application

You'll need Infrastructure as Code to deploy this. I use AWS SAM in my repo because it's Lambda-native, but CDK, Terraform, and Serverless Framework all support container images. Here's what the SAM configuration looks like:

```yaml
MyFunction:
  Type: AWS::Serverless::Function
  Properties:
    PackageType: Image
    ImageUri: !Sub ${AWS::AccountId}.dkr.ecr.${AWS::Region}.amazonaws.com/your-repo:latest
```

## Next Steps

Now that you can package Lambda functions in containers, you have options:

- Optimize containerized Lambda cold starts by using a compiled language your image (more on this in Part 2)

- Use non-AWS base images for even more control (coming up in this series)

- Implement multi-stage builds to separate build tools from runtime

Check out the [complete example repo](https://github.com/curiousdev-io/aws-lambda-container-images/tree/main) to see all these concepts working together, including:

- Automated builds and deployments

- Local testing setup

- AWS SAM template configuration

In Part 2 of the series, I'll show how to build a containerized Lambda function using a AWS OS-only base image.

Container packaging isn't just a size workaround—it's a workflow upgrade. Whether you need that 10GB limit or you just want familiar Docker tooling, you now have a path forward.

Stay curious! 🚀
