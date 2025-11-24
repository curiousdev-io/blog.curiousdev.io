---
slug: aws-lambda-container-images-part-2-aws-os-only-image-for-lambda
title: AWS Lambda Container Images (Part 2 - AWS OS-only Image for Lambda)
authors: [Brian]
tags: [aws, lambda, container]
---

<script async data-uid="2f82f140d9" src="https://curiousdev.kit.com/2f82f140d9/index.js"></script>

You're a Go (or Rust) developer and you're really looking forward to deploying your awesome Lambda application in a OS-only container. Let's look at how to do it.
<!--truncate-->

📦 Code Along: This post references a complete working example on [GitHub](https://github.com/curiousdev-io/aws-lambda-container-images/tree/main). Clone it to follow along hands-on.

## Brief Review

In my previous post, I went over the benefits of packaging AWS Lambda functions in container. Didn't read it? Don't worry - [here's the link to Part 1 of the series](/aws-lambda-container-images-part-1-aws-base-image-for-lambda).

## What's So Different This Time Around?

There's a subtle, but important difference between my last post and this one. The last post focused on building out a python3.13 Lambda function that ran on a fully-baked AWS image. This image included _everything_ needed to run a function - the language runtime, [the runtime interface emulator](https://github.com/aws/aws-lambda-runtime-interface-emulator/), and a [list of operating system packages](https://docs.aws.amazon.com/linux/al2023/ug/al2023-container-image-types.html). As a developer, all you need to do is pack up your code in the container and you're ready to go.

OS-only images are a bit different. They're more spartan. They're commonly used to create container images for compiled languages (like Go and Rust) and also provide an on-ramp for languages that Lambda doesn't officially support. You'll need to include the [the runtime interface emulator](https://github.com/aws/aws-lambda-runtime-interface-emulator/) for your language in the image.

In this post, I'll show you how I created the go1.25 equivalent function to my [python3.13 example](https://github.com/curiousdev-io/aws-lambda-container-images/blob/main/aws-base-images/python/README.md).

Let's revisit the question of why someone might want to use an OS-only image. We know it's commonly used for compiled languages and custom runtimes, but what other benefits are there to using a compiled language on an OS-only beyond flexibility?

Size!

In this case, OS-only images tend to be smaller than their AWS-provided runtime equivalents. My `python3.13` image is 194172940 bytes (185MB) in ECR. My `go1.25` image is 42403667 bytes (40MB).

So what?

Remember that the container data needs to make it to the Lambda execution environment on initialization (i.e. cold start). Less data to transfer makes for a faster cold start.

One of the (many) nice things about writing Lambda functions in Go is that the [aws-lambda-go/lambda](https://github.com/aws/aws-lambda-go) module includes the runtime interface emulator.

### Step 1: Create Your Dockerfile

Packaging Lambda functions written in compiled languages is a little different. In this instance, we're going to take advantage of a build stage to compile our Lambda to a static binary before copying it to our runtime image.

What does this mean?

In this instance, we can use a really small go1.25 Alpine image to build my Lambda binary.

```bash
# --- Build stage ---
FROM golang:1.25-alpine AS build
# Do things to build and compile my static binary
...
...
# --- Runtime stage ---
FROM public.ecr.aws/lambda/provided:al2023
# Copy my static binary to a location in the OS-only image
FROM public.ecr.aws/lambda/provided:al2023
COPY --from=build /src/bootstrap /var/runtime/bootstrap
RUN chmod +x /var/runtime/bootstrap
CMD ["bootstrap"] # bootstrap is the name of my binary
```

This snippet is purposefully small. It's done to illustrate the minimal `Dockerfile` you would need. Not included in the snippet is your actual function code. See the [supporting repository](https://github.com/curiousdev-io/aws-lambda-container-images/tree/main/aws-os-only-images) for more detail around the rest of the application.

Now that we've built our image, let's test it locally before deploying it.

### Step 2: Local Docker

You can have the same local experience with your Go Lambda running in a OS-only image as you would with a python3.13 Lambda running in a AWS-provided image.

You can take advantage of that same great Docker tooling to run the application locally. 

Here's the magic: AWS Lambda's runtime interface client (included in the aws-lambda-go/lambda module) implements a local endpoint at port 8080. When you run the container locally, you're hitting this same interface Lambda will use in production.

```bash
docker buildx build --platform linux/arm64 --provenance=false --tag curiousdev-io/go:1.25 .
docker run -p 9000:8080 curiousdev-io/go:1.25 &
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
docker tag curiousdev-io/go:1.25 \
  ${ACCOUNT_NUMBER}.dkr.ecr.${AWS_REGION}.amazonaws.com/your-repo-name:latest

# Push
docker push ${ACCOUNT_NUMBER}.dkr.ecr.${AWS_REGION}$.amazonaws.com/your-repo-name:latest
```

I've automated the entire flow in my [accompanying repo](https://github.com/curiousdev-io/aws-lambda-container-images/blob/main/aws-os-only-images/go/.config/mise/tasks/publish-image) - check it out to save yourself some typing.


### Step 5: Build and Deploy Your Serverless Application

You'll need Infrastructure as Code to deploy this. I use AWS SAM in my repo because it's Lambda-native, but CDK, Terraform, and Serverless Framework all support container images. Here's what the SAM configuration looks like:

```yaml
MyOsOnlyContainerLambdaFunction:
  Type: AWS::Serverless::Function
  Properties:
    PackageType: Image
    ImageUri: !Sub ${AWS::AccountId}.dkr.ecr.${AWS::Region}.amazonaws.com/your-repo:latest
```

## Next Steps

Now that you can package Lambda functions in OS-only containers, you have options:

- Keep using the AWS-provided images (covered in [Part 1](/aws-lambda-container-images-part-1-aws-base-image-for-lambda))

- Use non-AWS base images for even more control (coming up in Part 3)

Check out the [complete example repo](https://github.com/curiousdev-io/aws-lambda-container-images/tree/main/aws-os-only-images) to see all these concepts working together, including:

- Automated builds and deployments

- Local testing setup

- AWS SAM template configuration

In [Part 3](/aws-lambda-container-images-part-3-custom-image-for-lambda) of the series, I'll show how to build a containerized Lambda function using a non-AWS base image.

Stay curious! 🚀
