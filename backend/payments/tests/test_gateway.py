from payments.gateways import MockBankingGateway, get_gateway


def test_mock_gateway_returns_completed_with_a_reference():
    gateway = MockBankingGateway()
    result = gateway.initiate_payment(amount="1000.00", reference="INV-1")
    assert result.status == "completed"
    assert result.gateway_reference
    assert result.failure_reason is None


def test_get_gateway_returns_mock_gateway_by_default(settings):
    settings.BANKING_GATEWAY = "mock"
    gateway = get_gateway()
    assert isinstance(gateway, MockBankingGateway)
