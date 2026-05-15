class TenantError < StandardError
  def initialize(msg = "Tenant not found or not authorized")
    super
  end
end
