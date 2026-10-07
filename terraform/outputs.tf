# Output important information after deployment

output "instance_id" {
  description = "EC2 Instance ID"
  value       = aws_instance.hope_backend.id
}

output "instance_public_ip" {
  description = "Public IP address (Elastic IP)"
  value       = aws_eip.hope_eip.public_ip
}

output "instance_public_dns" {
  description = "Public DNS name"
  value       = aws_instance.hope_backend.public_dns
}

output "security_group_id" {
  description = "Security Group ID"
  value       = aws_security_group.hope_sg.id
}

output "backend_api_url" {
  description = "Backend API URL"
  value       = "http://${aws_eip.hope_eip.public_ip}"
}

output "backend_health_check" {
  description = "Backend health check endpoint"
  value       = "http://${aws_eip.hope_eip.public_ip}/health"
}

output "frontend_url" {
  description = "Frontend URL (if deployed on EC2)"
  value       = var.deploy_frontend ? "http://${aws_eip.hope_eip.public_ip}:3000" : "Deploy separately to S3"
}

output "ssh_connection_command" {
  description = "SSH command to connect to the instance"
  value       = "ssh -i ~/.ssh/id_rsa ubuntu@${aws_eip.hope_eip.public_ip}"
}

output "ami_id" {
  description = "AMI ID used for the instance"
  value       = data.aws_ami.ubuntu.id
}

output "ami_name" {
  description = "AMI name"
  value       = data.aws_ami.ubuntu.name
}

output "deployment_summary" {
  description = "Deployment summary"
  value = <<-EOT

    ========================================
    🎉 HOPE Project Deployment Complete!
    ========================================

    Backend API:     http://${aws_eip.hope_eip.public_ip}
    Health Check:    http://${aws_eip.hope_eip.public_ip}/health
    Frontend:        http://${aws_eip.hope_eip.public_ip}:3000

    SSH Command:
    ssh -i ~/.ssh/id_rsa ubuntu@${aws_eip.hope_eip.public_ip}

    Instance Details:
    - Instance ID:   ${aws_instance.hope_backend.id}
    - Instance Type: ${var.instance_type}
    - Region:        ${var.aws_region}
    - AMI:           ${data.aws_ami.ubuntu.name}

    Next Steps:
    1. Wait 5-10 minutes for setup to complete
    2. Check health: curl http://${aws_eip.hope_eip.public_ip}/health
    3. Test login at: http://${aws_eip.hope_eip.public_ip}:3000
    4. Monitor logs: ssh in and run 'pm2 logs'

    Cost Estimate: ~$30/month (t3.medium)
    ========================================
  EOT
}
