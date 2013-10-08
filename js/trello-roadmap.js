var syntax = /start: (.*)/;
var $auth;


$(function() {

var onAuthorize = function() {
	try {
		$auth.empty();
	} catch(e) {}
	updateLoggedIn();
		$("#output").empty();
		$("#functions").show();
			Trello.members.get("me", function(member){
			$("#fullName").text(member.fullName);
			
			var $cards = $("<div>")
				.text("Lade...")
					.appendTo("#output");
			
			Trello.get("members/me/cards", function(cards) {
	            $cards.empty();
	            Roadmap(cards, member);
	        });
		});

};

var updateLoggedIn = function() {
var isLoggedIn = Trello.authorized();
	$("#loggedout").toggle(!isLoggedIn);
	$("#loggedin").toggle(isLoggedIn);        
};
		
var logout = function() {
	Trello.deauthorize();
	updateLoggedIn();
};
								  
Trello.authorize({
	interactive:false,
	success: onAuthorize
});


$("#connectLink")
	.click(function(){
		$auth = $("<div>")
				.text("Authorisieren...")
					.appendTo("#output");
		Trello.authorize({
			type: "popup",
			success: onAuthorize
		})
	});
			
$("#disconnect").click(logout);
});

var data = {};
data.lanes = new Array();
data.items = new Array();

function Roadmap(cards, member) {
	data.lanes.push({
		id: 1,
		label: member.fullName
	})
	$.each(cards, function(ix, card) {

		if(card.due) {
			card.end = new Date(card.due);
			
			var ds = syntax.exec(card.desc);
			if(ds) {					
				card.start = Date.parse(ds[1]);
			} else {									
				card.start = new Date(card.end).add(-1).days();					
			}
			
			data.items.push({
							id: ix,
							lane: 1,
							title: card.name,
							start: card.start,
							end: card.end,
							url: card.url+" ",
							desc: card.desc,
							class: "past"
						});
		}
	});
	//data2roadmap(data);
}


function getDummyData() {
	var data = {
		lanes: [{
			id: 1,
			label: "Linie Eins"
		},
		{
			id: 2,
			label: "Linie Zwei"
		}],
		items: [
		{
			id: 1,
			lane: 1,
			start: (13).days().ago(),
			end: (2).days().ago(),
			desc: "Testkarte",
			class: "past"
		},{
			id: 2,
			lane: 2,
			start: (11).days().ago(),
			end: (4).days().ago(),
			desc: "Testkarte 2",
			class: "past"
		},
		]
	}

	return data;
}