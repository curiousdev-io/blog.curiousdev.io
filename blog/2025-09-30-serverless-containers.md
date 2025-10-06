---
slug: aws-lambda-container-images
title: AWS Lambda Container Images
authors: [Brian]
tags: [aws, lambda, container]
---

AWS Lambda is a compute service that runs code without the need to manage servers. In this post I'll look at why you might want to package your function code in a container image, how to do it, and how to take advantage of additional capabilities.

<!--truncate-->

## Why Use Container Packaging?

AWS Lambda functions can be packaged in either a zip archive or in a container image. What might make a developer choose container packaging?

- **Larger deployment size** Container packages can be up to 10GB - that's much larger than the 50MB (zipped) and 250MB (unzipped) available to zip packaged AWS Lambda functions.
- **Docker workflow** If you and your team already use Docker to build container applications then you may choose to lean into familiar tooling and experience.
- **Dependency management** Containers allow you install OS packages, compile native extensions, and configure your exact runtime.
- **Easier local testing** You can run the exact same image locally as you deploy to AWS.
- **Easier to switch between serverless compute services** I love Lambda and default to using it but, over time, you may not be the right choice for your application. With a little bit of forethought you can minimize the switching costs with container images.

## How to Build AWS Lambda Container Images

[tl;dr I have a code repository supporting showing you how to do this in depth - the snippets below are illustrative only](https://github.com/curiousdev-io/aws-lambda-container-images/tree/main)

There are a few different ways to build out Lambda functions using container imaging. The first is to build upon an AWS base image for Lambda. This will be the focus of this post. Subsequent posts will look at using AWS OS-only images and non-AWS base images.

### Step 0: Why Use a AWS-Provided Image?

So...why start with an AWS-provided image? Simple - it includes everything you need to get your function to run. It contains the runtime and, more importantly, the Runtime Interface Client (RIC) - the thing that polls the Lambda Runtime API for events.

### Step 1: Dockerfile

If you're familiar with Docker already then you'll be familiar with the syntax of the `Dockerfile`. Using a `Dockerfile` for AWS Lambda functions is actually pretty straightforward. Here is a sample one. Even if you're not a Docker expert it's likely you can follow along.

```bash
# Image from https://gallery.ecr.aws/lambda/python
FROM public.ecr.aws/lambda/python:3.13

# Copy requirements.txt
COPY requirements.txt ${LAMBDA_TASK_ROOT}

# Install the specified packages
RUN pip install -r requirements.txt

# Copy function code
COPY src ${LAMBDA_TASK_ROOT}

# Set default CMD for Lambda
CMD [ "lambda_function.handler" ]
```

### Step 2: Local Docker

With the `Dockerfile` and your accompanying code, you can actually run your image locally and experiment with it. AWS provides other mechanisms for zip-packaged Lambda functions (looking at you, AWS SAM CLI) but they're not needed for local containers. Just run your Docker CLI and start the container in the background:

```bash
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

### Step 3: Create the Amazon Elastic Container (ECR) Registry

AWS Lambda functions packaged as containers must be sourced from Amazon ECR. You can use the AWS CLI to create a repository. I'm following the practice of creating a single ECR repository per function.

```bash
aws ecr create-repository --region "$REGION" --repository-name your-repo-name
```

### Step 4: Push the Local Container Image

You should publish the local image to ECR at this point. THere are a few things you'll need to do.

* Authenticate Docker to ECR

* Tag the local image with your ECR URI

* Push the image to ECR

In my [accompanying repo](https://github.com/curiousdev-io/aws-lambda-container-images), this is all laid out in the [publish-image](https://github.com/curiousdev-io/aws-lambda-container-images/blob/main/aws-base-images/python/.config/mise/tasks/publish-image) mise task.

### Step 5: Build and Deploy Your Serverless Application

You'll need to create your serverless application. I create a HTTP API in my [accompanying repo](https://github.com/curiousdev-io/aws-lambda-container-images) using the AWS Serverless Application Model (AWS SAM) but you can use the AWS CLI, AWS CDK, Terraform...whatevs. It's really up to you. The important thing is that you configure your AWS Lambda function to use a container image rather than a zip file.

### Step 6: Profit

Ok... I suppose if you create a really novel application then this is where you can collect all the monies. If you're using my [accompanying repo](https://github.com/curiousdev-io/aws-lambda-container-images) I assure you you're not. 

## Conclusion

There are a few extra steps needed to deploy a container based AWS Lambda function but all of it can be automated using CI/CD processes. Keep in mind what you can get in return and consider whether you have a need for container packaged functions.


Stay curious! 🚀
