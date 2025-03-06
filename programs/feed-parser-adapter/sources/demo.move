module switchboard_feed_parser::switchboard_feed_parser {
    use std::signer;
    use switchboard_adapter::aggregator; // For reading aggregators
    use switchboard_adapter::math;

    const EAGGREGATOR_INFO_EXISTS:u64 = 0;
    const ENO_AGGREGATOR_INFO_EXISTS:u64 = 1;

    /*
      Num 
      {
        neg: bool,   // sign
        dec: u8,     // scaling factor
        value: u128, // value
      }

      where decimal = neg * value * 10^(-1 * dec) 
    */
    struct AggregatorInfo has copy, drop, store, key {
        aggregator_addr: address,
        latest_result: u128,
        latest_result_scaling_factor: u8,
    }

    // add AggregatorInfo resource with latest value + aggregator address
    public entry fun log_aggregator_info(
        account: &signer,
        aggregator_addr: address, 
    ) {       
        assert!(!exists<AggregatorInfo>(signer::address_of(account)), EAGGREGATOR_INFO_EXISTS);

        // get latest value 
        let (value, scaling_factor, _neg) = math::unpack(aggregator::latest_value(aggregator_addr)); 
        move_to(account, AggregatorInfo {
            aggregator_addr: aggregator_addr,
            latest_result: value,
            latest_result_scaling_factor: scaling_factor
        });
    }

    #[test(account = @0x1)]
    public entry fun test_aggregator(account: &signer) {

        // creates test aggregator with data
        aggregator::new_test(account, 100, 0, false);

        // print out value
        std::debug::print(&aggregator::latest_value(signer::address_of(account)));
    }
}
